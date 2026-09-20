"use server";

import { getStaffAuthRecordByEmail } from "@/lib/db/staff";
import { getPlatformAdminByEmail } from "@/lib/db/platformAdmins";
import { issuePasswordResetToken } from "@/lib/auth/passwordReset";
import { checkAndRecordLoginAttempt } from "@/lib/db/loginAttempts";

/**
 * Always resolves with no signal either way — never reveals whether an
 * email has an account (same enumeration-protection stance the old
 * Firebase-based page already had). A disabled staff account is
 * deliberately excluded: getting a reset link wouldn't help them sign in
 * anyway, and it avoids handing a working password to someone who
 * shouldn't have access anymore.
 */
export async function requestPasswordResetAction(email: string): Promise<void> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return;

  // Reuses the login rate limiter's table under a distinct key prefix —
  // this endpoint sends email, not a login attempt, but the same
  // per-identifier throttling shape (don't let someone spam an inbox)
  // applies just as well.
  const { allowed } = await checkAndRecordLoginAttempt(`reset:${trimmed}`);
  if (!allowed) return;

  const staff = await getStaffAuthRecordByEmail(trimmed);
  if (staff && !staff.disabled) {
    await issuePasswordResetToken(staff.id, trimmed);
    return;
  }

  const admin = await getPlatformAdminByEmail(trimmed);
  if (admin) {
    await issuePasswordResetToken(admin.id, trimmed);
  }
}
