import "server-only";
import { prisma } from "@/lib/db/client";

// Brute-force protection for the self-rolled /login password check (see
// prisma/schema.prisma's LoginAttempt comment for why this is a separate
// table from SignupAttempt, keyed by email instead of IP).
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS_PER_WINDOW = 10;
const RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Call once per /login submission, BEFORE checking the password — returns
 * `allowed: false` once an email has been attempted
 * MAX_ATTEMPTS_PER_WINDOW times (successful or failed) within WINDOW_MS.
 * Always records this attempt, so the count keeps climbing for as long as
 * someone keeps trying rather than resetting.
 */
export async function checkAndRecordLoginAttempt(email: string): Promise<{ allowed: boolean }> {
  const now = Date.now();

  await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: BigInt(now - RETENTION_MS) } } });

  const recentCount = await prisma.loginAttempt.count({
    where: { email, createdAt: { gte: BigInt(now - WINDOW_MS) } },
  });

  await prisma.loginAttempt.create({ data: { email, createdAt: BigInt(now) } });

  return { allowed: recentCount < MAX_ATTEMPTS_PER_WINDOW };
}
