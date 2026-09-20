"use server";

import { hashPassword } from "@/lib/auth/password";
import { createClinic } from "@/lib/db/clinics";
import { createStaffMember, getStaffAuthRecordByEmail } from "@/lib/db/staff";
import { checkAndRecordSignupAttempt } from "@/lib/db/signupAttempts";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { getClientIp } from "@/lib/request";
import { createSessionCookieForSubject } from "@/lib/session";
import { TRIAL_LENGTH_DAYS } from "@/lib/subscription";

const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignUpResult {
  error?: string;
  redirectTo?: string;
}

/**
 * The self-serve counterpart to scripts/createClinic.mjs. Fully self-rolled
 * now (see lib/auth/password.ts) — no more external Auth account to create
 * first and roll back on failure if the clinic/staff setup fails partway
 * through: it's all one database, so a failure here just leaves an orphaned
 * Clinic row with no staff (rare, and harmless — nothing can sign into it).
 * Mints the session cookie directly on success, so the caller can navigate
 * straight to /dashboard without a separate client-side sign-in step.
 *
 * Rate-limited by IP (see lib/db/signupAttempts.ts) AND gated by a
 * Cloudflare Turnstile challenge (lib/turnstile.ts) — a genuinely public,
 * unauthenticated endpoint that creates real accounts. The rate limit alone
 * closes off scripted abuse from one IP; Turnstile closes the gap a bot
 * rotating across many IPs would otherwise slip through, since it never
 * trips a per-IP counter. Turnstile verification is skipped entirely (not
 * required) until TURNSTILE_SECRET_KEY is actually configured — see
 * lib/turnstile.ts.
 */
export async function createTrialClinicAction(input: {
  clinicName: string;
  ownerName: string;
  email: string;
  password: string;
  turnstileToken: string;
}): Promise<SignUpResult> {
  const clientIp = getClientIp();

  const { allowed } = await checkAndRecordSignupAttempt(clientIp);
  if (!allowed) {
    return { error: "Too many signup attempts from this network. Please try again in a bit." };
  }

  if (!(await verifyTurnstileToken(input.turnstileToken, clientIp))) {
    return { error: "Verification failed. Please try again." };
  }

  const clinicName = input.clinicName.trim();
  const ownerName = input.ownerName.trim();
  const email = input.email.trim().toLowerCase();
  const { password } = input;

  if (!clinicName) return { error: "Clinic name is required." };
  if (!ownerName) return { error: "Your name is required." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const existing = await getStaffAuthRecordByEmail(email);
  if (existing) {
    return { error: "An account with this email already exists. Sign in instead." };
  }

  try {
    const passwordHash = await hashPassword(password);
    const trialEndsAt = Date.now() + TRIAL_LENGTH_DAYS * DAY_MS;

    const clinic = await createClinic({ name: clinicName, subscriptionStatus: "trialing", trialEndsAt });
    const staff = await createStaffMember({
      clinicId: clinic.id,
      name: ownerName,
      email,
      role: "owner",
      passwordHash,
    });

    await createSessionCookieForSubject({
      uid: staff.id,
      email,
      clinicId: clinic.id,
      role: "owner",
      superAdmin: false,
    });

    return { redirectTo: "/dashboard" };
  } catch (err) {
    console.error("Signup: failed to provision clinic:", err);
    return { error: "Something went wrong setting up your clinic. Please try again." };
  }
}
