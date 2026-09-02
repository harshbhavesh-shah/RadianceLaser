import { NextRequest, NextResponse } from "next/server";
import { getAllClinics } from "@/lib/db/clinics";
import {
  getUpcomingUnremindedAppointments,
  markReminderSent,
} from "@/lib/db/appointments";
import {
  getVisitsPendingFeedback,
  createVisitFeedback,
  markFeedbackSent,
  deleteUnsentVisitFeedback,
} from "@/lib/db/visitFeedback";
import { getWhatsAppConnection } from "@/lib/db/whatsapp";
import { getClinicMessageTemplates } from "@/lib/db/messageTemplates";
import { sendTemplateMessage } from "@/lib/bhashsms/client";
import { normalizePhone } from "@/lib/phone";
import { formatTime12h } from "@/lib/calendar";
import type { Clinic, MessageTemplate } from "@/types";

// Polled by an external scheduler (cron-job.org — see the README/setup
// notes for the exact job config: GET this URL every 15 minutes with an
// "Authorization: Bearer <CRON_SECRET>" custom header) rather than Vercel
// Cron, since Vercel's own cron only runs once/day on the Hobby plan —
// far too coarse for "remind N hours before" to land anywhere close to
// on time. Nothing here is Vercel-specific: requireCronAuth below just
// checks the one header, so any scheduler that can set a custom header
// and hit a URL on an interval works identically. This is the automation
// behind Settings > Communication's reminder/feedback-survey toggles —
// two independent jobs, one pass per clinic per poll:
//
//   1. Appointment reminders — an appointment becomes "due" once it's
//      within `reminderHoursBefore` of its start time; sent once
//      (Appointment.reminderSentAt guards against a repeat on the next
//      poll) via the clinic's "appointment_reminder" template.
//
//   2. Post-visit feedback — a visit becomes "due" once `delayHours` has
//      passed since it was logged; a VisitFeedback row (with a fresh
//      token for the public /feedback/[token] page) is created right
//      before sending, and rolled back if the send itself fails, so it's
//      retried on the next poll instead of silently never sent.
//
// Both are no-ops for a clinic unless WhatsApp is actually connected and
// the matching template exists — checked here, not assumed, since either
// can lapse (disconnected account, deleted template) independently of the
// clinic's own reminderEnabled/feedbackSurveyEnabled toggle.
//
// Every send is wrapped so one clinic's bad WhatsApp credentials, one
// malformed phone number, etc. can never take down the rest of the run —
// each appointment/visit either succeeds or is quietly left for the next
// poll to retry, and the whole route always returns 200 with a summary.

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
    // Due once inside the reminder window, but not for something that's
    // already started — a same-poll edge case (very short windows, or a
    // gap between scheduled cron runs) shouldn't send a "reminder" for an
    // appointment that's already underway or passed.
    if (dueIn > windowMs || dueIn <= 0) continue;

    const phone = normalizePhone(appt.patientPhone);
    if (!phone) continue;

    try {
      await sendTemplateMessage(connection, phone, template.name, [
        appt.patientName,
        appt.date,
        formatTime12h(appt.time),
      ]);
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
    console.error("NEXT_PUBLIC_APP_URL is not set — skipping feedback surveys for", clinic.id);
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
      await sendTemplateMessage(connection, phone, template.name, [visit.patientName, link]);
      await markFeedbackSent(feedback.id);
      sent++;
    } catch (err) {
      console.error(`Feedback survey failed for visit ${visit.visitId} (clinic ${clinic.id}):`, err);
      await deleteUnsentVisitFeedback(feedback.id).catch(() => {});
    }
  }
  return sent;
}

export async function GET(req: NextRequest) {
  if (!requireCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clinics = await getAllClinics();
  const activeClinics = clinics.filter((c) => c.reminderEnabled || c.feedbackSurveyEnabled);

  let remindersSent = 0;
  let surveysSent = 0;

  for (const clinic of activeClinics) {
    try {
      const connection = await getWhatsAppConnection(clinic.id);
      if (!connection || connection.status !== "connected") continue;

      const templates = await getClinicMessageTemplates(clinic.id);
      remindersSent += await processReminders(clinic, templates, connection);
      surveysSent += await processFeedbackSurveys(clinic, templates, connection);
    } catch (err) {
      console.error(`Scheduled messages failed for clinic ${clinic.id}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    clinicsChecked: activeClinics.length,
    remindersSent,
    surveysSent,
  });
}
