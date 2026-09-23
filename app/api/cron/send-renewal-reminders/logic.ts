import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/resend";
import { getClinicDeadline, REMINDER_THRESHOLD_DAYS } from "@/lib/subscription";
import type { SubscriptionStatus } from "@/types";

// Split out of route.ts — Next.js's App Router only allows a route file to
// export specific handlers (GET, POST, config, ...); any other export
// fails the production build ("is not a valid Route export field"), which
// route.test.ts importing these directly ran straight into.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReminderCandidate {
  id: string;
  name: string;
  deadline: number;
  isTrial: boolean;
}

export interface ClinicForReminder {
  id: string;
  name: string;
  subscriptionStatus: string;
  trialEndsAt: bigint;
  subscriptionRenewsAt: bigint | null;
  renewalReminderSentForDeadline: bigint | null;
}

/** Pure — no DB, no network — so a test can exercise the actual selection
 * logic (inside the reminder window, not already sent for this exact
 * deadline) against a fabricated list of clinics instead of the real ones
 * in the database, which GET reads via prisma.clinic.findMany() with no
 * clinic filter at all. */
export function buildReminderCandidates(clinics: ClinicForReminder[], now: number): ReminderCandidate[] {
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

  return candidates;
}

function renewalReminderEmailHtml(input: { clinicName: string; daysRemaining: number; isTrial: boolean; billingUrl: string }): string {
  const { clinicName, daysRemaining, isTrial, billingUrl } = input;
  const whatEnds = isTrial ? "free trial" : "subscription";
  const timing = daysRemaining <= 1 ? "tomorrow" : `in ${daysRemaining} days`;

  return `
    <div style="background:#FBF8F3;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
      <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid #E8DDC9;border-radius:12px;padding:32px;">
        <div style="font-size:22px;font-weight:bold;color:#2C1D14;">Lumière by Radiance</div>
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

/** Sends and records one candidate at a time so a test can do that
 * against a single seeded clinic instead of the whole database. */
export async function sendReminderForCandidate(
  candidate: ReminderCandidate,
  ownerEmail: string,
  appUrl: string,
  now: number
): Promise<void> {
  const daysRemaining = Math.ceil((candidate.deadline - now) / DAY_MS);
  await sendEmail({
    to: ownerEmail,
    subject: candidate.isTrial
      ? `Your Lumière by Radiance trial ends ${daysRemaining <= 1 ? "tomorrow" : `in ${daysRemaining} days`}`
      : `Your Lumière by Radiance subscription renews ${daysRemaining <= 1 ? "tomorrow" : `in ${daysRemaining} days`}`,
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
}
