"use server";

import { adminAuth } from "@/lib/firebase/admin";
import { issueTwoFactorChallenge, verifyTwoFactorCode } from "@/lib/twoFactor";
import { getStaffMemberByUid, createStaffMember } from "@/lib/db/staff";
import { createClinic } from "@/lib/db/clinics";
import { TRIAL_LENGTH_DAYS } from "@/lib/subscription";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TwoFactorCheckResult {
  required: boolean;
  error?: string;
}

/**
 * Called right after primary sign-in (password or Google) succeeds
 * client-side, before that ID token gets exchanged for a session cookie.
 * If this account opted into email-OTP 2FA (Settings → toggled per staff
 * member — see lib/twoFactor.ts), this sends the code and tells the client
 * to show the "enter your code" screen instead of proceeding straight to
 * /dashboard. The password/Google check already happened by this point —
 * this is an *additional* gate on the session-cookie step, not a
 * replacement for primary auth.
 */
export async function requestTwoFactorIfEnabledAction(idToken: string): Promise<TwoFactorCheckResult> {
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    const clinicId = decoded.clinicId as string | undefined;
    if (!clinicId) return { required: false }; // super-admin-only account, or not provisioned yet

    const staff = await getStaffMemberByUid(decoded.uid);
    if (staff?.twoFactorEnabled !== true) return { required: false };

    await issueTwoFactorChallenge(decoded.uid, decoded.email || "");
    return { required: true };
  } catch (err) {
    console.error("Failed to check/issue 2FA challenge:", err);
    return { required: false, error: "Something went wrong. Please try again." };
  }
}

export interface TwoFactorVerifyActionResult {
  success?: boolean;
  error?: string;
}

export async function verifyTwoFactorCodeAction(
  idToken: string,
  code: string
): Promise<TwoFactorVerifyActionResult> {
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    const result = await verifyTwoFactorCode(decoded.uid, code);

    switch (result) {
      case "ok":
        return { success: true };
      case "expired":
        return { error: "That code has expired. Go back and sign in again for a new one." };
      case "too-many-attempts":
        return { error: "Too many incorrect attempts. Go back and sign in again for a new code." };
      case "no-challenge":
        return { error: "No pending code for this account. Go back and sign in again." };
      case "invalid":
        return { error: "Incorrect code. Please try again." };
    }
  } catch (err) {
    console.error("Failed to verify 2FA code:", err);
    return { error: "Something went wrong. Please try again." };
  }
}

export interface ProvisionGoogleClinicResult {
  error?: string;
  success?: boolean;
}

/**
 * The Google-sign-in equivalent of app/signup/actions.ts
 * createTrialClinicAction — used when someone completes Google sign-in for
 * the first time (no clinicId claim yet on their token). Firebase Auth
 * already created the Auth user automatically the moment signInWithPopup
 * succeeded, so unlike the email/password signup flow, this only attaches
 * the clinic doc + custom claims + staff mirror to the account that
 * already exists, rather than also creating one.
 */
export async function provisionGoogleClinicAction(
  idToken: string,
  clinicName: string
): Promise<ProvisionGoogleClinicResult> {
  const trimmedName = clinicName.trim();
  if (!trimmedName) return { error: "Clinic name is required." };

  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    if (decoded.clinicId) {
      // Shouldn't normally happen (the client only calls this for accounts
      // it just detected as claim-less), but never silently re-provision an
      // account that already belongs to a clinic.
      return { error: "This account is already attached to a clinic." };
    }

    const trialEndsAt = Date.now() + TRIAL_LENGTH_DAYS * DAY_MS;
    const clinic = await createClinic({ name: trimmedName, subscriptionStatus: "trialing", trialEndsAt });

    await adminAuth().setCustomUserClaims(decoded.uid, { clinicId: clinic.id, role: "owner" });

    await createStaffMember({
      uid: decoded.uid,
      clinicId: clinic.id,
      name: decoded.name || decoded.email || "Clinic Owner",
      email: decoded.email || "",
      role: "owner",
    });

    return { success: true };
  } catch (err) {
    console.error("Failed to provision Google clinic:", err);
    return { error: "Something went wrong setting up your clinic. Please try again." };
  }
}
