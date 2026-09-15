import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

// Polled by the same external scheduler as the other cron routes
// (cron-job.org, Authorization: Bearer <CRON_SECRET>) — kept as its own
// route rather than folded into send-renewal-reminders, since that one only
// ever sends email and never mutates subscriptionStatus/planTier. Mixing a
// state transition into an email-sending route risks a partial-failure
// state (the email throws, the transition never happens, or vice versa);
// splitting them matches the existing one-route-one-job convention
// (send-scheduled-messages vs. send-renewal-reminders are already split
// this way). Daily cadence is enough — deadlines only move in whole days.
//
// Once a "trialing" clinic's trialEndsAt has passed, this permanently
// settles it onto the free tier rather than leaving it locked forever — a
// brand-new signup that never subscribes should keep basic access, not get
// treated as a lapsed paid account. Setting subscriptionRenewsAt to null on
// an "active" clinic is the exact combination lib/subscription.ts's
// getClinicAccess() already treats as "active forever, never locks" — zero
// changes needed there. A clinic that WAS paying and lapses is untouched by
// this query (its subscriptionStatus is "active" or "canceled", never
// "trialing" again), so the existing lock-on-non-renewal behavior for paid
// clinics is unaffected.

function requireCronAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// Exported (only) for route.test.ts — split out so a test can check one
// seeded clinic's id shows up (or doesn't) among expired trials without
// asserting anything about the full list, and can flip one clinic without
// ever querying/mutating every clinic in the database. GET below is what
// actually walks everything, and — like send-scheduled-messages' GET —
// isn't something a test should call directly against a real, shared
// database.
export async function findExpiredTrialClinicIds(now: number): Promise<string[]> {
  const expired = await prisma.clinic.findMany({
    where: { subscriptionStatus: "trialing", trialEndsAt: { lte: BigInt(now) } },
    select: { id: true },
  });
  return expired.map((c) => c.id);
}

export async function expireTrialClinic(clinicId: string): Promise<void> {
  await prisma.clinic.update({
    where: { id: clinicId },
    data: { subscriptionStatus: "active", planTier: "free", subscriptionRenewsAt: null },
  });
}

export async function GET(req: NextRequest) {
  if (!requireCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expiredIds = await findExpiredTrialClinicIds(Date.now());
  for (const clinicId of expiredIds) {
    await expireTrialClinic(clinicId);
  }

  return NextResponse.json({ ok: true, expired: expiredIds.length });
}
