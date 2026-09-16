import { prisma } from "@/lib/db/client";

// Split out of route.ts — Next.js's App Router only allows a route file
// to export specific handlers (GET, POST, config, ...); any other export
// fails the production build ("is not a valid Route export field"), which
// route.test.ts importing these directly ran straight into. Splitting
// also lets a test check one seeded clinic's id shows up (or doesn't)
// among expired trials without asserting anything about the full list,
// and flip one clinic without ever querying/mutating every clinic in the
// database — GET (in route.ts) is what actually walks everything, and —
// like send-scheduled-messages' GET — isn't something a test should call
// directly against a real, shared database.

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
