import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getClinicOwnerEmails } from "@/lib/db/staff";
import { buildReminderCandidates, sendReminderForCandidate } from "./logic";

// Polled by the same external scheduler as app/api/cron/send-scheduled-
// messages (cron-job.org, Authorization: Bearer <CRON_SECRET>) — kept as
// its own route rather than folded into that one, since this is email, not
// WhatsApp, and applies to every clinic regardless of whether WhatsApp is
// even connected. Once a day is plenty (deadlines only move in whole
// days), unlike the 15-minute WhatsApp poll.
//
// Fills the "No outbound trial/renewal reminders" gap from the README —
// previously the countdown only ever showed as an in-app banner
// (components/TrialBanner.tsx), so a clinic owner who didn't happen to log
// in during their last week got silently locked out with no warning at
// all. Same REMINDER_THRESHOLD_DAYS window as that banner, and only ever
// sent once per distinct deadline (see prisma/schema.prisma's
// Clinic.renewalReminderSentForDeadline). Candidate selection and the
// per-clinic send both live in logic.ts, not here — see that file's own
// comment.

function requireCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never run unauthenticated, even locally
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!requireCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    console.error("NEXT_PUBLIC_APP_URL is not set, skipping renewal reminders");
    return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL is not set" }, { status: 500 });
  }

  const clinics = await prisma.clinic.findMany({
    select: {
      id: true,
      name: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      subscriptionRenewsAt: true,
      renewalReminderSentForDeadline: true,
    },
  });

  const now = Date.now();
  const candidates = buildReminderCandidates(clinics, now);

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, remindersSent: 0 });
  }

  const ownerEmails = await getClinicOwnerEmails(candidates.map((c) => c.id));

  let remindersSent = 0;
  for (const candidate of candidates) {
    const ownerEmail = ownerEmails[candidate.id];
    if (!ownerEmail) continue; // no owner on record — nothing to send to

    try {
      await sendReminderForCandidate(candidate, ownerEmail, appUrl, now);
      remindersSent++;
    } catch (err) {
      console.error(`Renewal reminder failed for clinic ${candidate.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, remindersSent });
}
