"use server";

import { adminAuth } from "@/lib/firebase/admin";
import { createClinic } from "@/lib/db/clinics";
import { createStaffMember } from "@/lib/db/staff";
import { checkAndRecordSignupAttempt } from "@/lib/db/signupAttempts";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { getClientIp } from "@/lib/request";
import { TRIAL_LENGTH_DAYS } from "@/lib/subscription";

const DAY_MS = 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignUpResult {
  error?: string;
  success?: boolean;
}

/**
 * The self-serve counterpart to scripts/createClinic.mjs — same shape
 * (clinic doc + Auth user + custom claims + staff mirror doc), but callable
 * from an unauthenticated public route instead of a local script. Doesn't
 * sign the new owner in itself: it only creates the account server-side
 * (required, since setting custom claims needs the Admin SDK); the signup
 * form then signs in client-side with the same email/password right after
 * this succeeds, reusing the exact login flow (app/login/page.tsx) to
 * exchange for a session cookie — so there's exactly one code path that
 * turns "signed in" into a session cookie, not two.
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

  const auth = adminAuth();

  let uid: string;
  try {
    const userRecord = await auth.createUser({ email, password, displayName: ownerName });
    uid = userRecord.uid;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "auth/email-already-exists") {
      return { error: "An account with this email already exists. Sign in instead." };
    }
    console.error("Signup: failed to create Auth user:", err);
    return { error: "Something went wrong creating your account. Please try again." };
  }

  try {
    const trialEndsAt = Date.now() + TRIAL_LENGTH_DAYS * DAY_MS;

    const clinic = await createClinic({ name: clinicName, subscriptionStatus: "trialing", trialEndsAt });

    await auth.setCustomUserClaims(uid, { clinicId: clinic.id, role: "owner" });

    await createStaffMember({
      uid,
      clinicId: clinic.id,
      name: ownerName,
      email,
      role: "owner",
    });

    return { success: true };
  } catch (err) {
    // The Auth account exists but the clinic/claims/staff doc setup failed
    // partway through — clean up the orphaned account rather than leaving a
    // login with no clinic attached (getSession() would reject it anyway,
    // but better not to leave it around at all).
    console.error("Signup: failed to provision clinic, rolling back Auth user:", err);
    await auth.deleteUser(uid).catch(() => {});
    return { error: "Something went wrong setting up your clinic. Please try again." };
  }
}
