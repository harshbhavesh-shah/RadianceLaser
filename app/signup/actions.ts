"use server";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
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
 * No CAPTCHA or rate limiting yet — this is a genuinely public,
 * unauthenticated endpoint that creates real accounts, which is a known gap
 * worth closing before this gets meaningful signup traffic (see README).
 */
export async function createTrialClinicAction(input: {
  clinicName: string;
  ownerName: string;
  email: string;
  password: string;
}): Promise<SignUpResult> {
  const clinicName = input.clinicName.trim();
  const ownerName = input.ownerName.trim();
  const email = input.email.trim().toLowerCase();
  const { password } = input;

  if (!clinicName) return { error: "Clinic name is required." };
  if (!ownerName) return { error: "Your name is required." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const auth = adminAuth();
  const db = adminDb();

  let uid: string;
  try {
    const userRecord = await auth.createUser({ email, password, displayName: ownerName });
    uid = userRecord.uid;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "auth/email-already-exists") {
      return { error: "An account with this email already exists — sign in instead." };
    }
    console.error("Signup: failed to create Auth user:", err);
    return { error: "Something went wrong creating your account. Please try again." };
  }

  try {
    const clinicRef = db.collection("clinics").doc();
    const trialEndsAt = Date.now() + TRIAL_LENGTH_DAYS * DAY_MS;

    await clinicRef.set({
      name: clinicName,
      createdAt: Date.now(),
      subscriptionStatus: "trialing",
      trialEndsAt,
    });

    await auth.setCustomUserClaims(uid, { clinicId: clinicRef.id, role: "owner" });

    await db.collection("staff").doc(uid).set({
      clinicId: clinicRef.id,
      uid,
      name: ownerName,
      email,
      role: "owner",
      createdAt: Date.now(),
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
