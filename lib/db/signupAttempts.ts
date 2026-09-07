import "server-only";
import { prisma } from "@/lib/db/client";

// Abuse protection for /signup (app/signup/actions.ts) — see
// prisma/schema.prisma's SignupAttempt comment for why this exists.
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_ATTEMPTS_PER_WINDOW = 5;
// Rows older than this are pure clutter — nothing ever reads that far back,
// so they're swept opportunistically (see checkAndRecordSignupAttempt)
// rather than needing a separate cron job just for this table.
const RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Call once per /signup submission, BEFORE doing anything else — returns
 * `allowed: false` once an IP has made MAX_ATTEMPTS_PER_WINDOW attempts
 * (successful or failed; a burst of failed attempts is exactly what this
 * is meant to catch) within WINDOW_MS. Always records this attempt
 * (whether or not it's the one that trips the limit), so the count keeps
 * climbing for as long as someone keeps trying rather than resetting.
 */
export async function checkAndRecordSignupAttempt(ipAddress: string): Promise<{ allowed: boolean }> {
  const now = Date.now();

  // Opportunistic cleanup — cheap enough to run on every call (a single
  // indexed delete), and means this table never needs its own maintenance
  // job.
  await prisma.signupAttempt.deleteMany({ where: { createdAt: { lt: BigInt(now - RETENTION_MS) } } });

  const recentCount = await prisma.signupAttempt.count({
    where: { ipAddress, createdAt: { gte: BigInt(now - WINDOW_MS) } },
  });

  await prisma.signupAttempt.create({ data: { ipAddress, createdAt: BigInt(now) } });

  return { allowed: recentCount < MAX_ATTEMPTS_PER_WINDOW };
}
