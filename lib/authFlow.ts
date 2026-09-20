"use client";

import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { GoogleAuthProvider, signInWithCredential, signInWithPopup, type UserCredential } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { createSessionFromGoogleIdToken, verifyLoginTwoFactorAction } from "@/app/login/actions";

/**
 * Shared by app/login/page.tsx and components/auth/SignUpForm.tsx. Google
 * blocks OAuth sign-in inside an embedded WebView (the account picker opens
 * but never hands control back) — signInWithPopup() only works on the real
 * web. Inside the Android app, this goes through Android's native account
 * picker instead (via @capacitor-firebase/authentication) and exchanges the
 * resulting Google credential for a Firebase sign-in with signInWithCredential,
 * so callers get back the same UserCredential shape either way.
 *
 * Email/password sign-in no longer touches Firebase at all (see
 * app/login/actions.ts signInAction) — Google is the one remaining path
 * that still does, until a later migration chunk replaces this too.
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  if (!Capacitor.isNativePlatform()) {
    return signInWithPopup(auth, new GoogleAuthProvider());
  }

  const result = await FirebaseAuthentication.signInWithGoogle();
  if (!result.credential?.idToken) {
    throw new Error("Google sign-in did not return a credential.");
  }
  const credential = GoogleAuthProvider.credential(result.credential.idToken, result.credential.accessToken);
  return signInWithCredential(auth, credential);
}

// Matches just the two router methods actually used here — avoids importing
// Next's internal (and version-fragile) app-router type path just to type
// this parameter.
interface MinimalRouter {
  push: (href: string) => void;
  refresh: () => void;
}

function navigateAfterAuth(router: MinimalRouter, nextParam: string | null, redirectTo: string | undefined) {
  router.push(nextParam || redirectTo || "/dashboard");
  router.refresh();
}

export interface GoogleAuthOutcome {
  otpRequired?: boolean;
  uid?: string;
  needsClinicName?: boolean;
  idToken?: string;
  suggestedName?: string;
  error?: string;
}

/**
 * Runs Google sign-in (web popup or native) then hands the resulting ID
 * token to the server-side bridge (app/login/actions.ts
 * createSessionFromGoogleIdToken) — shared by app/login/page.tsx and
 * app/signup/page.tsx (a Google sign-in on the signup page can land on an
 * account that already exists) so this sequence can't drift out of sync or
 * accidentally skip the 2FA gate between the two entry points.
 */
export async function signInWithGoogleAndProceed(
  router: MinimalRouter,
  nextParam: string | null
): Promise<GoogleAuthOutcome> {
  const credential = await signInWithGoogle();
  const idToken = await credential.user.getIdToken();
  const result = await createSessionFromGoogleIdToken(idToken);

  if (result.error) return { error: result.error };
  if (result.needsClinicName) {
    return { needsClinicName: true, idToken: result.idToken, suggestedName: result.suggestedName };
  }
  if (result.otpRequired) return { otpRequired: true, uid: result.uid };

  navigateAfterAuth(router, nextParam, result.redirectTo);
  return {};
}

/** Call once the user submits the code from the OTP screen sign-in (password
 * or Google) triggered — both funnel into the same uid-keyed 2FA challenge
 * (see lib/twoFactor.ts), so this one function covers either entry point. */
export async function finishLoginOtp(
  uid: string,
  code: string,
  router: MinimalRouter,
  nextParam: string | null
): Promise<{ error?: string }> {
  const result = await verifyLoginTwoFactorAction(uid, code);
  if (result.error) return { error: result.error };
  navigateAfterAuth(router, nextParam, result.redirectTo);
  return {};
}

export { navigateAfterAuth };
