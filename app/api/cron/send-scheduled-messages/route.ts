import { NextRequest, NextResponse } from "next/server";
import { getAllClinics } from "@/lib/db/clinics";
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
import { getClinicNoShowFollowUps } from "@/lib/db/noShowFollowUps";
import { hasNoShowMessageBeenSent, logNoShowMessageSent } from "@/lib/db/noShowMessageLog";
import {
  createNoShowSurveyResponse,
  markNoShowSurveySent,
  deleteUnsentNoShowSurveyResponse,
} from "@/lib/db/noShowSurvey";
import { getWhatsAppConnection } from "@/lib/db/whatsapp";
import { getClinicMessageTemplates } from "@/lib/db/messageTemplates";
import { activeProvider } from "@/lib/whatsapp/activeProvider";
import { normalizePhone } from "@/lib/phone";
import { formatTime12h } from "@/lib/calendar";
import type { Clinic, MessageTemplate, NoShowFollowUp } from "@/types";

// Polled every 15 min by an external scheduler (cron-job.org, with an
// Authorization: Bearer <CRON_SECRET> header) instead of Vercel Cron,
// since Vercel's Hobby plan only runs cron once a day. Four jobs, one pass
// per clinic per poll:
//
//   1. Appointment reminders: send once inside reminderHoursBefore of
//      the appointment's start time. Appointment.reminderSentAt stops a
//      repeat.
//   2. Post-visit feedback: send once delayHours has passed since the
//      visit. Creates a VisitFeedback row with a token for the public
//      /feedback/[token] page; deleted again if the send fails, so it
//      retries next poll.
//   3. No show auto-detect: always runs, no toggle. A "booked"
//      appointment more than 2 hours past its end time with no Visit
//      logged gets flipped to "no-show". Manual marking still works too.
//   4. No show follow-ups: a clinic's own configurable list
//      (components/no-shows/FollowUpsSection.tsx). Each fires delayHours
//      after the appointment's scheduled time via its linked
//      "no_show_followup" template. Survey-kind follow-ups create a
//      NoShowSurveyResponse first for the link; NoShowMessageLog guards
//      against duplicate sends per (appointment, follow-up).
//
// 1/2/4 need WhatsApp connected and the matching template to exist.
// Everything's wrapped in try/catch so one bad send never blocks the rest
// of the run. A failure just gets retried on the next poll.

function requireCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never run unauthenticated, even locally
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function findTemplate(templates: MessageTemplate[], category: MessageTemplate["category"]): MessageTemplate | undefined {
  return templates.find((t) => t.category === category);
}

async function processReminders(clinic: Clinic, templates: MessageTemplate[], connection: NonNullable<Awaited<ReturnType<typeof getWhatsAppConnection>>>): Promise<number> {
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
        [appt.patientName, appt.date, formatTime12h(appt.time)],
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

async function processFeedbackSurveys(clinic: Clinic, templates: MessageTemplate[], connection: NonNullable<Awaited<ReturnType<typeof getWhatsAppConnection>>>): Promise<number> {
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
async function autoDetectNoShows(clinicId: string): Promise<number> {
  const stale = await getStaleBookedAppointments(clinicId);
  for (const appt of stale) {
    await updateAppointmentStatus(appt.id, "no-show");
  }
  return stale.length;
}

async function processNoShowFollowUps(
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

      if (followUp.kind === "survey") {
        if (!appUrl) {
          console.error("NEXT_PUBLIC_APP_URL is not set, skipping no show survey for", clinic.id);
          continue;
        }
        const survey = await createNoShowSurveyResponse(clinic.id, appt.id, appt.patientName);
        surveyId = survey.id;
        secondVar = `${appUrl.replace(/\/$/, "")}/no-show-survey/${survey.token}`;
      }

      try {
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

export async function GET(req: NextRequest) {
  if (!requireCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clinics = await getAllClinics();

  let remindersSent = 0;
  let surveysSent = 0;
  let noShowsDetected = 0;
  let noShowMessagesSent = 0;

  for (const clinic of clinics) {
    try {
      noShowsDetected += await autoDetectNoShows(clinic.id);
    } catch (err) {
      console.error(`No show auto-detect failed for clinic ${clinic.id}:`, err);
    }
  }

  const followUpsByClinic = new Map<string, NoShowFollowUp[]>();
  for (const clinic of clinics) {
    const followUps = await getClinicNoShowFollowUps(clinic.id);
    if (followUps.some((f) => f.enabled)) followUpsByClinic.set(clinic.id, followUps);
  }

  const activeClinics = clinics.filter(
    (c) => c.reminderEnabled || c.feedbackSurveyEnabled || followUpsByClinic.has(c.id)
  );

  for (const clinic of activeClinics) {
    try {
      const connection = await getWhatsAppConnection(clinic.id);
      if (!connection || connection.status !== "connected") continue;

      const templates = await getClinicMessageTemplates(clinic.id);
      remindersSent += await processReminders(clinic, templates, connection);
      surveysSent += await processFeedbackSurveys(clinic, templates, connection);

      const followUps = followUpsByClinic.get(clinic.id);
      if (followUps) {
        noShowMessagesSent += await processNoShowFollowUps(clinic, followUps, templates, connection);
      }
    } catch (err) {
      console.error(`Scheduled messages failed for clinic ${clinic.id}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    clinicsChecked: activeClinics.length,
    remindersSent,
    surveysSent,
    noShowsDetected,
    noShowMessagesSent,
  });
}
