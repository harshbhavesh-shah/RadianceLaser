import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getClinicOwnerEmails } from "@/lib/db/staff";
import { sendEmail } from "@/lib/email/resend";
import { getClinicDeadline, REMINDER_THRESHOLD_DAYS } from "@/lib/subscription";
import type { SubscriptionStatus } from "@/types";

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
// Clinic.renewalReminderSentForDeadline).

const DAY_MS = 24 * 60 * 60 * 1000;

function requireCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never run unauthenticated, even locally
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

interface ReminderCandidate {
  id: string;
  name: string;
  deadline: number;
  isTrial: boolean;
}

function renewalReminderEmailHtml(input: { clinicName: string; daysRemaining: number; isTrial: boolean; billingUrl: string }): string {
  const { clinicName, daysRemaining, isTrial, billingUrl } = input;
  const whatEnds = isTrial ? "free trial" : "subscription";
  const timing = daysRemaining <= 1 ? "tomorrow" : `in ${daysRemaining} days`;

  return `
    <div style="background:#FBF8F3;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
      <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #E8DDC9;border-radius:12px;padding:32px;">
        <div style="font-size:22px;font-weight:bold;color:#2C1D14;">Radiance Laser</div>
        <div style="height:2px;width:32px;background:#A9812F;margin:12px 0 24px;"></div>
        <p style="font-family:Arial,sans-serif;font-size:14px;color:#4A342A;margin:0 0 16px;">
          ${clinicName}'s ${whatEnds} ends ${timing}.
        </p>
        <p style="font-family:Arial,sans-serif;font-size:14px;color:#4A342A;margin:0 0 24px;">
          ${
            isTrial
              ? "Subscribe now to keep your patients, packages, and records accessible without interruption."
              : "Renew now to avoid losing write access. Your data stays safe either way, but nothing can be added or changed until you do."
          }
        </p>
        <a href="${billingUrl}" style="display:inline-block;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;color:#FBF8F3;background:#2C1D14;border-radius:8px;padding:12px 24px;text-decoration:none;">
          ${isTrial ? "Subscribe" : "Renew now"}
        </a>
      </div>
    </div>
  `;
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
  const candidates: ReminderCandidate[] = [];

  for (const clinic of clinics) {
    const deadline = getClinicDeadline({
      subscriptionStatus: clinic.subscriptionStatus as SubscriptionStatus,
      trialEndsAt: Number(clinic.trialEndsAt),
      subscriptionRenewsAt: clinic.subscriptionRenewsAt !== null ? Number(clinic.subscriptionRenewsAt) : undefined,
    });
    if (deadline === null) continue; // locked/canceled — not a "coming due" case

    const daysRemaining = Math.ceil((deadline - now) / DAY_MS);
    if (daysRemaining > REMINDER_THRESHOLD_DAYS || daysRemaining <= 0) continue;

    const alreadySentForThisDeadline =
      clinic.renewalReminderSentForDeadline !== null && Number(clinic.renewalReminderSentForDeadline) === deadline;
    if (alreadySentForThisDeadline) continue;

    candidates.push({ id: clinic.id, name: clinic.name, deadline, isTrial: clinic.subscriptionStatus === "trialing" });
  }

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, remindersSent: 0 });
  }

  const ownerEmails = await getClinicOwnerEmails(candidates.map((c) => c.id));

  let remindersSent = 0;
  for (const candidate of candidates) {
    const ownerEmail = ownerEmails[candidate.id];
    if (!ownerEmail) continue; // no owner on record — nothing to send to

    const daysRemaining = Math.ceil((candidate.deadline - now) / DAY_MS);
    try {
      await sendEmail({
        to: ownerEmail,
        subject: candidate.isTrial
          ? `Your Radiance Laser trial ends ${daysRemaining <= 1 ? "tomorrow" : `in ${daysRemaining} days`}`
          : `Your Radiance Laser subscription renews ${daysRemaining <= 1 ? "tomorrow" : `in ${daysRemaining} days`}`,
        html: renewalReminderEmailHtml({
          clinicName: candidate.name,
          daysRemaining,
          isTrial: candidate.isTrial,
          billingUrl: `${appUrl}/dashboard/settings#billing`,
        }),
      });
      await prisma.clinic.update({
        where: { id: candidate.id },
        data: { renewalReminderSentForDeadline: BigInt(candidate.deadline) },
      });
      remindersSent++;
    } catch (err) {
      console.error(`Renewal reminder failed for clinic ${candidate.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, remindersSent });
}
