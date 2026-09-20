"use server";

import { adminAuth } from "@/lib/firebase/admin";
import { verifyPassword } from "@/lib/auth/password";
import {
  getStaffAuthRecordByEmail,
  getStaffAuthRecordByUid,
  getStaffMemberByUid,
  createStaffMember,
} from "@/lib/db/staff";
import { getPlatformAdminByEmail } from "@/lib/db/platformAdmins";
import { checkAndRecordLoginAttempt } from "@/lib/db/loginAttempts";
import { createClinic } from "@/lib/db/clinics";
import { createSessionCookieForSubject } from "@/lib/session";
import { issueTwoFactorChallenge, verifyTwoFactorCode } from "@/lib/twoFactor";
import { TRIAL_LENGTH_DAYS } from "@/lib/subscription";
import type { UserRole } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const GENERIC_LOGIN_ERROR = "Incorrect email or password.";

export interface SignInResult {
  error?: string;
  otpRequired?: boolean;
  uid?: string;
  redirectTo?: string;
}

function redirectFor(clinicId: string | null, superAdmin: boolean): string {
  return !clinicId && superAdmin ? "/admin" : "/dashboard";
}

/**
 * The self-rolled email/password sign-in check — replaces the old client-side
 * Firebase signInWithEmailAndPassword. Checks StaffMember first (the common
 * case), then PlatformAdmin (a pure super-admin with no clinic at all — see
 * prisma/schema.prisma). Deliberately the same generic error either way a
 * lookup or password check fails, so a response never reveals whether an
 * email exists in the system.
 */
export async function signInAction(email: string, password: string): Promise<SignInResult> {
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !password) return { error: "Email and password are required." };

  const { allowed } = await checkAndRecordLoginAttempt(trimmedEmail);
  if (!allowed) return { error: "Too many attempts. Please wait a few minutes and try again." };

  const staff = await getStaffAuthRecordByEmail(trimmedEmail);
  if (staff) {
    if (staff.disabled) return { error: "This account has been disabled. Contact your clinic owner." };

    const valid = await verifyPassword(password, staff.passwordHash);
    if (!valid) return { error: GENERIC_LOGIN_ERROR };

    const staffMember = await getStaffMemberByUid(staff.id);
    if (staffMember?.twoFactorEnabled) {
      await issueTwoFactorChallenge(staff.id, trimmedEmail);
      return { otpRequired: true, uid: staff.id };
    }

    await createSessionCookieForSubject({
      uid: staff.id,
      email: trimmedEmail,
      clinicId: staff.clinicId,
      role: staff.role,
      superAdmin: staff.superAdmin,
    });
    return { redirectTo: redirectFor(staff.clinicId, staff.superAdmin) };
  }

  const admin = await getPlatformAdminByEmail(trimmedEmail);
  if (admin) {
    const valid = await verifyPassword(password, admin.passwordHash);
    if (!valid) return { error: GENERIC_LOGIN_ERROR };

    await createSessionCookieForSubject({
      uid: admin.id,
      email: trimmedEmail,
      clinicId: null,
      role: null,
      superAdmin: true,
    });
    return { redirectTo: "/admin" };
  }

  return { error: GENERIC_LOGIN_ERROR };
}

export interface TwoFactorVerifyActionResult {
  success?: boolean;
  error?: string;
  redirectTo?: string;
}

/**
 * Verifies the emailed 2FA code and, on success, mints the session cookie —
 * the step requestTwoFactorIfEnabledAction/signInAction above gates. `uid`
 * comes back from signInAction's `otpRequired` response; it isn't a secret
 * (a StaffMember row id), the actual gate is the hashed, rate-limited code
 * itself (see lib/twoFactor.ts).
 */
export async function verifyLoginTwoFactorAction(uid: string, code: string): Promise<TwoFactorVerifyActionResult> {
  const result = await verifyTwoFactorCode(uid, code);

  switch (result) {
    case "expired":
      return { error: "That code has expired. Go back and sign in again for a new one." };
    case "too-many-attempts":
      return { error: "Too many incorrect attempts. Go back and sign in again for a new code." };
    case "no-challenge":
      return { error: "No pending code for this account. Go back and sign in again." };
    case "invalid":
      return { error: "Incorrect code. Please try again." };
    case "ok":
      break;
  }

  const staff = await getStaffAuthRecordByUid(uid);
  if (!staff) return { error: "Something went wrong. Please try again." };

  await createSessionCookieForSubject({
    uid: staff.id,
    email: staff.email,
    clinicId: staff.clinicId,
    role: staff.role,
    superAdmin: staff.superAdmin,
  });
  return { success: true, redirectTo: redirectFor(staff.clinicId, staff.superAdmin) };
}

export interface GoogleSignInResult {
  error?: string;
  redirectTo?: string;
  needsClinicName?: boolean;
  // Only set alongside needsClinicName — echoed back to
  // provisionGoogleClinicAction so it doesn't need to re-verify the ID
  // token characteristics the client already has in hand.
  idToken?: string;
  suggestedName?: string;
  // Same otpRequired/uid shape as SignInResult — the client's OTP-entry
  // step (finishAfterOtp in lib/authFlow.ts) is shared between both sign-in
  // methods, so it always calls verifyLoginTwoFactorAction with this uid.
  otpRequired?: boolean;
  uid?: string;
}

/**
 * TEMPORARY Google sign-in bridge — Google sign-in (web popup + native
 * Android) still goes through Firebase Auth for one more migration chunk
 * (verifying who this Google account is), but no longer through Firebase's
 * createSessionCookie/custom-claims machinery: clinicId/role/superAdmin all
 * come straight from this account's own StaffMember row in Postgres now,
 * the same single source of truth email/password login uses. Once native
 * Google sign-in is migrated off Firebase entirely, this whole function
 * goes away and Google sign-in becomes just another call into
 * createSessionCookieForSubject.
 */
export async function createSessionFromGoogleIdToken(idToken: string): Promise<GoogleSignInResult> {
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    const staff = await getStaffAuthRecordByUid(decoded.uid);

    if (!staff) {
      return {
        needsClinicName: true,
        idToken,
        suggestedName: (decoded.name as string | undefined) || decoded.email || undefined,
      };
    }
    if (staff.disabled) return { error: "This account has been disabled. Contact your clinic owner." };

    const staffMember = await getStaffMemberByUid(staff.id);
    if (staffMember?.twoFactorEnabled) {
      await issueTwoFactorChallenge(staff.id, decoded.email || "");
      return { otpRequired: true, uid: staff.id };
    }

    await createSessionCookieForSubject({
      uid: staff.id,
      email: decoded.email || null,
      clinicId: staff.clinicId,
      role: staff.role,
      superAdmin: staff.superAdmin,
    });
    return { redirectTo: redirectFor(staff.clinicId, staff.superAdmin) };
  } catch (err) {
    console.error("Failed to sign in with Google:", err);
    return { error: "Something went wrong signing you in. Please try again." };
  }
}

export interface ProvisionGoogleClinicResult {
  error?: string;
  redirectTo?: string;
}

/**
 * The Google-sign-in equivalent of app/signup/actions.ts
 * createTrialClinicAction — used when someone completes Google sign-in for
 * the first time (no StaffMember row for their uid yet, per
 * createSessionFromGoogleIdToken above). Re-verifies the ID token itself
 * (not just trusting the uid the client echoes back) so this can't be used
 * to attach a clinic to an arbitrary account.
 */
export async function provisionGoogleClinicAction(
  idToken: string,
  clinicName: string
): Promise<ProvisionGoogleClinicResult> {
  const trimmedName = clinicName.trim();
  if (!trimmedName) return { error: "Clinic name is required." };

  try {
    const decoded = await adminAuth().verifyIdToken(idToken);

    const existing = await getStaffAuthRecordByUid(decoded.uid);
    if (existing) {
      return { error: "This account is already attached to a clinic." };
    }

    const trialEndsAt = Date.now() + TRIAL_LENGTH_DAYS * DAY_MS;
    const clinic = await createClinic({ name: trimmedName, subscriptionStatus: "trialing", trialEndsAt });

    const role: UserRole = "owner";
    await createStaffMember({
      id: decoded.uid,
      clinicId: clinic.id,
      name: decoded.name || decoded.email || "Clinic Owner",
      email: decoded.email || "",
      role,
      passwordHash: null,
    });

    await createSessionCookieForSubject({
      uid: decoded.uid,
      email: decoded.email || null,
      clinicId: clinic.id,
      role,
      superAdmin: false,
    });

    return { redirectTo: "/dashboard" };
  } catch (err) {
    console.error("Failed to provision Google clinic:", err);
    return { error: "Something went wrong setting up your clinic. Please try again." };
  }
}
