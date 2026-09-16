import { NextRequest, NextResponse } from "next/server";
import { getAllClinics } from "@/lib/db/clinics";
import { getClinicNoShowFollowUps } from "@/lib/db/noShowFollowUps";
import { getWhatsAppConnection } from "@/lib/db/whatsapp";
import { getClinicMessageTemplates } from "@/lib/db/messageTemplates";
import { processReminders, processFeedbackSurveys, autoDetectNoShows, processNoShowFollowUps } from "./logic";
import type { NoShowFollowUp } from "@/types";

// Polled every 15 min by an external scheduler (cron-job.org, with an
// Authorization: Bearer <CRON_SECRET> header) instead of Vercel Cron,
// since Vercel's Hobby plan only runs cron once a day. Four jobs, one pass
// per clinic per poll — see logic.ts for each one:
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
