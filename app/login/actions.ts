"use server";

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
import { getAuthSecret } from "@/lib/auth/session";
import { signToken, verifyToken } from "@/lib/auth/signedToken";
import { verifyGoogleSignInCode, verifyGoogleIdToken, type GoogleIdentity } from "@/lib/auth/googleSignIn";
import { issueTwoFactorChallenge, verifyTwoFactorCode } from "@/lib/twoFactor";
import { decryptTotpSecret, verifyTotp } from "@/lib/auth/totp";
import { getStaffTotp, recordStaffTotpStep } from "@/lib/db/staff";
import { TRIAL_LENGTH_DAYS } from "@/lib/subscription";
import type { UserRole } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const GENERIC_LOGIN_ERROR = "Incorrect email or password.";

export type TwoFactorMethod = "totp" | "email";

export interface SignInResult {
  error?: string;
  otpRequired?: boolean;
  // Short-lived signed proof that the password/Google step just passed —
  // the only thing verifyLoginTwoFactorAction accepts, so a bare uid can't be
  // used to brute-force codes without first knowing the password.
  twoFactorTicket?: string;
  twoFactorMethod?: TwoFactorMethod;
  redirectTo?: string;
}

const TWO_FACTOR_TICKET_PURPOSE = "login-2fa";
const TWO_FACTOR_TICKET_TTL_MS = 5 * 60 * 1000;

interface TwoFactorTicketPayload {
  purpose: typeof TWO_FACTOR_TICKET_PURPOSE;
  uid: string;
  method: TwoFactorMethod;
  exp: number;
}

/** Called after primary auth succeeds for an account with 2FA on. Accounts
 * with an authenticator app go straight to a TOTP prompt; legacy accounts
 * that enabled the old emailed-code 2FA (no seed yet) keep getting an email
 * code until they switch in Settings, so nobody silently loses 2FA. */
async function beginTwoFactor(uid: string, email: string): Promise<SignInResult> {
  const { secret } = await getStaffTotp(uid);
  const method: TwoFactorMethod = secret ? "totp" : "email";
  if (method === "email") await issueTwoFactorChallenge(uid, email);
  const twoFactorTicket = await signToken(
    { purpose: TWO_FACTOR_TICKET_PURPOSE, uid, method, exp: Date.now() + TWO_FACTOR_TICKET_TTL_MS },
    getAuthSecret()
  );
  return { otpRequired: true, twoFactorTicket, twoFactorMethod: method };
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
      return beginTwoFactor(staff.id, trimmedEmail);
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
 * Verifies the second factor (authenticator code, or the emailed code for
 * legacy accounts) and, on success, mints the session cookie. The ticket
 * comes from signInAction/finishGoogleSignIn and proves the first factor
 * passed; guesses are rate-limited per account on top of the 30s code
 * rotation and single-use time steps.
 */
export async function verifyLoginTwoFactorAction(ticket: string, code: string): Promise<TwoFactorVerifyActionResult> {
  const payload = await verifyToken<TwoFactorTicketPayload>(ticket, getAuthSecret());
  if (!payload || payload.purpose !== TWO_FACTOR_TICKET_PURPOSE || Date.now() > payload.exp) {
    return { error: "This sign-in has expired. Go back and sign in again." };
  }
  const { uid, method } = payload;

  if (method === "totp") {
    const { allowed } = await checkAndRecordLoginAttempt(`2fa:${uid}`);
    if (!allowed) return { error: "Too many attempts. Please wait a few minutes and try again." };

    const { secret: stored, lastStep } = await getStaffTotp(uid);
    const secret = stored ? decryptTotpSecret(stored) : null;
    if (!secret) return { error: "Something went wrong. Please sign in again." };
    const step = verifyTotp(secret, code, lastStep);
    if (step === null) return { error: "Incorrect code. Enter the current code from your authenticator app." };
    await recordStaffTotpStep(uid, step);
  } else {
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
  }

  const staff = await getStaffAuthRecordByUid(uid);
  if (!staff || staff.disabled) return { error: "Something went wrong. Please try again." };

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
  // Only set alongside needsClinicName — a short-lived signed ticket
  // proving Google already verified this email, echoed back to
  // provisionGoogleClinicAction. Not a raw ID token/code: the code from the
  // web popup flow is already single-use-consumed by the time this
  // returns, and re-deriving one for the native path would mean asking
  // Google twice for no reason — this ticket is our own, cheap to verify
  // (no network call), and carries exactly the one fact the next step
  // needs (see PROVISION_TICKET_PURPOSE below).
  ticket?: string;
  suggestedName?: string;
  // Same otpRequired/ticket shape as SignInResult — the client's code-entry
  // step (finishLoginOtp in lib/authFlow.ts) is shared between both sign-in
  // methods, so it always calls verifyLoginTwoFactorAction with this ticket.
  otpRequired?: boolean;
  twoFactorTicket?: string;
  twoFactorMethod?: TwoFactorMethod;
}

const PROVISION_TICKET_PURPOSE = "google-clinic-provision";
const PROVISION_TICKET_TTL_MS = 10 * 60 * 1000; // 10 minutes — just long enough to type a clinic name

interface ProvisionTicketPayload {
  purpose: typeof PROVISION_TICKET_PURPOSE;
  email: string;
  name: string | null;
  exp: number;
}

async function finishGoogleSignIn(identity: GoogleIdentity): Promise<GoogleSignInResult> {
  if (!identity.emailVerified) {
    return { error: "Your Google account's email address isn't verified." };
  }
  const email = identity.email.toLowerCase();

  const staff = await getStaffAuthRecordByEmail(email);
  if (!staff) {
    const ticket = await signToken(
      { purpose: PROVISION_TICKET_PURPOSE, email, name: identity.name, exp: Date.now() + PROVISION_TICKET_TTL_MS },
      getAuthSecret()
    );
    return { needsClinicName: true, ticket, suggestedName: identity.name || undefined };
  }
  if (staff.disabled) return { error: "This account has been disabled. Contact your clinic owner." };

  const staffMember = await getStaffMemberByUid(staff.id);
  if (staffMember?.twoFactorEnabled) {
    return beginTwoFactor(staff.id, email);
  }

  await createSessionCookieForSubject({
    uid: staff.id,
    email,
    clinicId: staff.clinicId,
    role: staff.role,
    superAdmin: staff.superAdmin,
  });
  return { redirectTo: redirectFor(staff.clinicId, staff.superAdmin) };
}

/** Web sign-in — see lib/authFlow.ts for the Google Identity Services popup
 * flow that produces this authorization code. */
export async function signInWithGoogleCodeAction(code: string): Promise<GoogleSignInResult> {
  const identity = await verifyGoogleSignInCode(code);
  if (!identity) return { error: "Google sign-in failed. Please try again." };
  return finishGoogleSignIn(identity);
}

/** Native (Android) sign-in — the device's own account picker hands back
 * an ID token directly, no code exchange needed. */
export async function signInWithGoogleIdTokenAction(idToken: string): Promise<GoogleSignInResult> {
  const identity = await verifyGoogleIdToken(idToken);
  if (!identity) return { error: "Google sign-in failed. Please try again." };
  return finishGoogleSignIn(identity);
}

export interface ProvisionGoogleClinicResult {
  error?: string;
  redirectTo?: string;
}

/**
 * The Google-sign-in equivalent of app/signup/actions.ts
 * createTrialClinicAction — used when someone completes Google sign-in for
 * the first time (no StaffMember row for their email yet, per
 * finishGoogleSignIn above). Verifies the ticket itself (not just trusting
 * the email the client echoes back) so this can't be used to attach a
 * clinic to an arbitrary address.
 */
export async function provisionGoogleClinicAction(
  ticket: string,
  clinicName: string
): Promise<ProvisionGoogleClinicResult> {
  const trimmedName = clinicName.trim();
  if (!trimmedName) return { error: "Clinic name is required." };

  const payload = await verifyToken<ProvisionTicketPayload>(ticket, getAuthSecret());
  if (!payload || payload.purpose !== PROVISION_TICKET_PURPOSE || Date.now() > payload.exp) {
    return { error: "This sign-in has expired. Please try Google sign-in again." };
  }

  try {
    const existing = await getStaffAuthRecordByEmail(payload.email);
    if (existing) {
      return { error: "This account is already attached to a clinic." };
    }

    const trialEndsAt = Date.now() + TRIAL_LENGTH_DAYS * DAY_MS;
    const clinic = await createClinic({ name: trimmedName, subscriptionStatus: "trialing", trialEndsAt });

    const role: UserRole = "owner";
    const staff = await createStaffMember({
      clinicId: clinic.id,
      name: payload.name || payload.email,
      email: payload.email,
      role,
      passwordHash: null,
    });

    await createSessionCookieForSubject({
      uid: staff.id,
      email: payload.email,
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
