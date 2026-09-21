"use client";

import { Capacitor } from "@capacitor/core";
import {
  signInWithGoogleCodeAction,
  signInWithGoogleIdTokenAction,
  verifyLoginTwoFactorAction,
} from "@/app/login/actions";

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
  twoFactorTicket?: string;
  twoFactorMethod?: "totp" | "email";
  needsClinicName?: boolean;
  ticket?: string;
  suggestedName?: string;
  error?: string;
}

const WEB_CLIENT_ID = "1010631493574-5gpchvg3dj2k5si2aairtv9lpojhresa.apps.googleusercontent.com";

let gisScriptPromise: Promise<void> | null = null;

/** Loads Google Identity Services' JS client once (idempotent — repeat
 * calls reuse the same in-flight/settled promise) rather than a static
 * &lt;script&gt; tag, since this is only ever needed on the login/signup
 * pages, not the whole app. */
function loadGoogleIdentityServices(): Promise<void> {
  if (gisScriptPromise) return gisScriptPromise;
  gisScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In."));
    document.head.appendChild(script);
  });
  return gisScriptPromise;
}

// Minimal shape of the `google.accounts.oauth2` global GIS adds to
// `window` — no @types package for this exists, and pulling in the full
// gapi type definitions just for this one call isn't worth it.
interface GoogleCodeClient {
  requestCode: () => void;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initCodeClient: (config: {
            client_id: string;
            scope: string;
            ux_mode: "popup";
            callback: (response: { code?: string; error?: string }) => void;
          }) => GoogleCodeClient;
        };
      };
    };
  }
}

/**
 * Web sign-in: Google Identity Services' authorization-code popup flow
 * (ux_mode: "popup") — the closest non-Firebase equivalent to the old
 * signInWithPopup() UX. The code it returns is exchanged server-side (see
 * app/login/actions.ts signInWithGoogleCodeAction), since that needs the
 * OAuth client secret.
 */
async function requestGoogleAuthCode(): Promise<string> {
  await loadGoogleIdentityServices();
  if (!window.google) throw new Error("Google Sign-In failed to load.");

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initCodeClient({
      client_id: WEB_CLIENT_ID,
      scope: "openid email profile",
      ux_mode: "popup",
      callback: (response) => {
        if (response.error || !response.code) {
          reject(new Error(response.error || "Google sign-in was cancelled."));
          return;
        }
        resolve(response.code);
      },
    });
    client.requestCode();
  });
}

/**
 * Native (Android) sign-in: the device's own Google account picker via
 * Credential Manager (@capgo/capacitor-social-login), not a WebView popup —
 * Google blocks OAuth popups inside embedded WebViews, which is exactly why
 * this app has a separate native path at all. Returns a Google ID token
 * directly, verified the same way as the web path's exchanged code (see
 * app/login/actions.ts signInWithGoogleIdTokenAction).
 */
async function requestGoogleIdTokenNative(): Promise<string> {
  const { SocialLogin } = await import("@capgo/capacitor-social-login");
  await SocialLogin.initialize({ google: { webClientId: WEB_CLIENT_ID } });
  const result = await SocialLogin.login({ provider: "google", options: { scopes: ["email", "profile"] } });
  // The default mode is "online" (GoogleLoginResponseOnline, which carries
  // idToken) — "offline" mode (serverAuthCode only, no idToken) is never
  // requested here, but the plugin's union type still needs narrowing.
  const idToken = "idToken" in result.result ? result.result.idToken : undefined;
  if (!idToken) throw new Error("Google sign-in did not return a credential.");
  return idToken;
}

/**
 * Runs Google sign-in (web popup or native) then hands the result to the
 * matching server-side verifier — shared by app/login/page.tsx and
 * app/signup/page.tsx (a Google sign-in on the signup page can land on an
 * account that already exists) so this sequence can't drift out of sync or
 * accidentally skip the 2FA gate between the two entry points.
 */
export async function signInWithGoogleAndProceed(
  router: MinimalRouter,
  nextParam: string | null
): Promise<GoogleAuthOutcome> {
  const result = Capacitor.isNativePlatform()
    ? await signInWithGoogleIdTokenAction(await requestGoogleIdTokenNative())
    : await signInWithGoogleCodeAction(await requestGoogleAuthCode());

  if (result.error) return { error: result.error };
  if (result.needsClinicName) {
    return { needsClinicName: true, ticket: result.ticket, suggestedName: result.suggestedName };
  }
  if (result.otpRequired) {
    return { otpRequired: true, twoFactorTicket: result.twoFactorTicket, twoFactorMethod: result.twoFactorMethod };
  }

  navigateAfterAuth(router, nextParam, result.redirectTo);
  return {};
}

/** Call once the user submits the code from the 2FA screen sign-in (password
 * or Google) triggered — both hand back the same signed ticket, so this one
 * function covers either entry point. */
export async function finishLoginOtp(
  ticket: string,
  code: string,
  router: MinimalRouter,
  nextParam: string | null
): Promise<{ error?: string }> {
  const result = await verifyLoginTwoFactorAction(ticket, code);
  if (result.error) return { error: result.error };
  navigateAfterAuth(router, nextParam, result.redirectTo);
  return {};
}

export { navigateAfterAuth };
