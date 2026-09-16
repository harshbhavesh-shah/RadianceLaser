import {
  getUpcomingUnremindedAppointments,
  markReminderSent,
  getStaleBookedAppointments,
  getRecentNoShowAppointments,
  updateAppointmentStatus,
} from "@/lib/db/appointments";
import {
  getVisitsPendingFeedback,
  createVisitFeedback,
  markFeedbackSent,
  deleteUnsentVisitFeedback,
} from "@/lib/db/visitFeedback";
import { hasNoShowMessageBeenSent, logNoShowMessageSent } from "@/lib/db/noShowMessageLog";
import {
  createNoShowSurveyResponse,
  markNoShowSurveySent,
  deleteUnsentNoShowSurveyResponse,
} from "@/lib/db/noShowSurvey";
import { getWhatsAppConnection } from "@/lib/db/whatsapp";
import { activeProvider } from "@/lib/whatsapp/activeProvider";
import { normalizePhone } from "@/lib/phone";
import { formatTime12h } from "@/lib/calendar";
import type { Clinic, MessageTemplate, NoShowFollowUp } from "@/types";

// The four per-clinic jobs behind app/api/cron/send-scheduled-messages'
// GET — split out of route.ts because Next.js's App Router only allows a
// route file to export specific handlers (GET, POST, config, ...); any
// other export fails the production build ("is not a valid Route export
// field"), which is exactly what happened here once route.test.ts started
// importing these directly for testing instead of going through the
// unscoped GET (see that test file's own comment on why it can't call GET
// against a real, shared database).

function findTemplate(templates: MessageTemplate[], category: MessageTemplate["category"]): MessageTemplate | undefined {
  return templates.find((t) => t.category === category);
}

export async function processReminders(clinic: Clinic, templates: MessageTemplate[], connection: NonNullable<Awaited<ReturnType<typeof getWhatsAppConnection>>>): Promise<number> {
  if (!clinic.reminderEnabled) return 0;
  const template = findTemplate(templates, "appointment_reminder");
  if (!template) return 0;

  const candidates = await getUpcomingUnremindedAppointments(clinic.id);
  const now = Date.now();
  const windowMs = clinic.reminderHoursBefore * 60 * 60 * 1000;

  let sent = 0;
  for (const appt of candidates) {
    const startsAt = new Date(`${appt.date}T${appt.time}:00`).getTime();
    const dueIn = startsAt - now;
    // Skip if outside the window, or already started.
    if (dueIn > windowMs || dueIn <= 0) continue;

    const phone = normalizePhone(appt.patientPhone);
    if (!phone) continue;

    try {
      await activeProvider.sendTemplateMessage(
        connection,
        phone,
        template.name,
        [appt.patientName, clinic.name, appt.date, formatTime12h(appt.time)],
        template.language
      );
      await markReminderSent(appt.id);
      sent++;
    } catch (err) {
      console.error(`Reminder failed for appointment ${appt.id} (clinic ${clinic.id}):`, err);
    }
  }
  return sent;
}

export async function processFeedbackSurveys(clinic: Clinic, templates: MessageTemplate[], connection: NonNullable<Awaited<ReturnType<typeof getWhatsAppConnection>>>): Promise<number> {
  if (!clinic.feedbackSurveyEnabled) return 0;
  const template = findTemplate(templates, "visit_feedback");
  if (!template) return 0;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    console.error("NEXT_PUBLIC_APP_URL is not set, skipping feedback surveys for", clinic.id);
    return 0;
  }

  const candidates = await getVisitsPendingFeedback(clinic.id, clinic.feedbackSurveyDelayHours);

  let sent = 0;
  for (const visit of candidates) {
    const phone = normalizePhone(visit.patientPhone || "");
    if (!phone) continue;

    const feedback = await createVisitFeedback(clinic.id, visit.visitId, visit.patientName);
    const link = `${appUrl.replace(/\/$/, "")}/feedback/${feedback.token}`;

    try {
      await activeProvider.sendTemplateMessage(connection, phone, template.name, [visit.patientName, link], template.language);
      await markFeedbackSent(feedback.id);
      sent++;
    } catch (err) {
      console.error(`Feedback survey failed for visit ${visit.visitId} (clinic ${clinic.id}):`, err);
      await deleteUnsentVisitFeedback(feedback.id).catch(() => {});
    }
  }
  return sent;
}

/** Pass 3. Runs for every clinic, no toggle. Returns how many appointments it flipped. */
export async function autoDetectNoShows(clinicId: string): Promise<number> {
  const stale = await getStaleBookedAppointments(clinicId);
  for (const appt of stale) {
    await updateAppointmentStatus(appt.id, "no-show");
  }
  return stale.length;
}

export async function processNoShowFollowUps(
  clinic: Clinic,
  followUps: NoShowFollowUp[],
  templates: MessageTemplate[],
  connection: NonNullable<Awaited<ReturnType<typeof getWhatsAppConnection>>>
): Promise<number> {
  const enabled = followUps.filter((f) => f.enabled);
  if (enabled.length === 0) return 0;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const noShows = await getRecentNoShowAppointments(clinic.id);
  const now = Date.now();

  let sent = 0;
  for (const followUp of enabled) {
    const template = templates.find((t) => t.id === followUp.templateId);
    if (!template) continue;

    for (const appt of noShows) {
      const endedAt =
        new Date(`${appt.date}T${appt.time}:00`).getTime() + appt.durationMinutes * 60 * 1000;
      if (now - endedAt < followUp.delayHours * 60 * 60 * 1000) continue;

      if (await hasNoShowMessageBeenSent(appt.id, followUp.id)) continue;

      const phone = normalizePhone(appt.patientPhone);
      if (!phone) continue;

      let secondVar = followUp.offerText || "";
      let surveyId: string | null = null;

      if (followUp.kind === "survey" && !appUrl) {
        console.error("NEXT_PUBLIC_APP_URL is not set, skipping no show survey for", clinic.id);
        continue;
      }

      try {
        if (followUp.kind === "survey") {
          // Inside the try, not above it — a failure here (a transient DB
          // error; createNoShowSurveyResponse itself already handles the
          // one-response-per-appointment race) must be caught the same as
          // a failed send below, or it throws out of this whole function
          // and skips every other appointment/follow-up still queued for
          // this clinic in this poll, not just this one.
          const survey = await createNoShowSurveyResponse(clinic.id, appt.id, appt.patientName);
          surveyId = survey.id;
          secondVar = `${appUrl!.replace(/\/$/, "")}/no-show-survey/${survey.token}`;
        }

        await activeProvider.sendTemplateMessage(
          connection,
          phone,
          template.name,
          [appt.patientName, secondVar],
          template.language
        );
        if (surveyId) await markNoShowSurveySent(surveyId);
        await logNoShowMessageSent(clinic.id, appt.id, followUp.id);
        sent++;
      } catch (err) {
        console.error(`No show follow-up "${followUp.name}" failed for appointment ${appt.id} (clinic ${clinic.id}):`, err);
        if (surveyId) await deleteUnsentNoShowSurveyResponse(surveyId).catch(() => {});
      }
    }
  }
  return sent;
}
