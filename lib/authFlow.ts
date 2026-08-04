"use client";

import { requestTwoFactorIfEnabledAction, verifyTwoFactorCodeAction } from "@/app/login/actions";

// Matches just the two router methods actually used here — avoids importing
// Next's internal (and version-fragile) app-router type path just to type
// this parameter.
interface MinimalRouter {
  push: (href: string) => void;
  refresh: () => void;
}

/**
 * Shared by app/login/page.tsx and app/signup/page.tsx (Google sign-in on
 * the signup page can land on an account that already exists, e.g. someone
 * who already has an account clicking "Continue with Google" on /signup by
 * mistake) so the "primary auth succeeded → check 2FA → exchange for a
 * session cookie" sequence — and specifically the 2FA gate — only lives in
 * one place. Duplicating it per entry point would risk one of them quietly
 * drifting out of sync and becoming a way to bypass a user's own 2FA.
 */
async function exchangeForSession(idToken: string, router: MinimalRouter, nextParam: string | null) {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error("Could not start a session. Please try again.");

  // A super-admin-only account (no clinicId at all) has nothing to show at
  // /dashboard — app/dashboard/layout.tsx's getSession() would return null
  // for it and bounce straight back to /login. Default it to /admin
  // instead; an explicit ?next= (e.g. from middleware redirecting an
  // unauthenticated visit) still wins either way.
  const payload = JSON.parse(atob(idToken.split(".")[1]));
  const isAdminOnly = payload.superAdmin === true && !payload.clinicId;
  const next = nextParam || (isAdminOnly ? "/admin" : "/dashboard");
  router.push(next);
  router.refresh();
}

export interface PrimaryAuthOutcome {
  otpRequired?: boolean;
  idToken?: string;
  error?: string;
}

/** Call after ANY primary auth succeeds (password or Google) for an account
 * that already has a clinicId claim. Returns {otpRequired: true, idToken}
 * if the caller should show an OTP entry screen instead of navigating away
 * — otherwise the session cookie is already set and the router has already
 * navigated. */
export async function proceedAfterPrimaryAuth(
  idToken: string,
  router: MinimalRouter,
  nextParam: string | null
): Promise<PrimaryAuthOutcome> {
  const check = await requestTwoFactorIfEnabledAction(idToken);
  if (check.error) return { error: check.error };
  if (check.required) return { otpRequired: true, idToken };
  await exchangeForSession(idToken, router, nextParam);
  return {};
}

/** Call once the user submits the code from the OTP screen `proceedAfterPrimaryAuth` triggered. */
export async function finishAfterOtp(
  idToken: string,
  code: string,
  router: MinimalRouter,
  nextParam: string | null
): Promise<{ error?: string }> {
  const result = await verifyTwoFactorCodeAction(idToken, code);
  if (result.error) return { error: result.error };
  await exchangeForSession(idToken, router, nextParam);
  return {};
}
