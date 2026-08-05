"use client";

import { Suspense, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  type UserCredential,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { provisionGoogleClinicAction } from "./actions";
import { proceedAfterPrimaryAuth as sharedProceedAfterPrimaryAuth, finishAfterOtp } from "@/lib/authFlow";

// credentials: the normal email/password (or "click Google") screen.
// otp: primary auth succeeded, this account has 2FA on — waiting on the
//   emailed code before a session cookie gets issued.
// google-clinic-name: a Google account signed in for the first time (no
//   clinicId claim yet) — needs a clinic name before it can be provisioned.
type Stage =
  | { name: "credentials" }
  | { name: "otp"; idToken: string }
  | { name: "google-clinic-name"; idToken: string; suggestedName: string };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [stage, setStage] = useState<Stage>({ name: "credentials" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // After ANY primary auth succeeds (password or Google, and for Google
  // only once a clinic actually exists on the account), decide whether the
  // 2FA gate applies before finishing sign-in — shared with
  // app/signup/page.tsx via lib/authFlow.ts so the gate can't drift out of
  // sync (or get skipped) between the two entry points.
  async function proceedAfterPrimaryAuth(idToken: string) {
    const outcome = await sharedProceedAfterPrimaryAuth(idToken, router, searchParams.get("next"));
    if (outcome.error) {
      setError(outcome.error);
      setLoading(false);
      return;
    }
    if (outcome.otpRequired && outcome.idToken) {
      setStage({ name: "otp", idToken: outcome.idToken });
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      await proceedAfterPrimaryAuth(idToken);
    } catch (err) {
      console.error(err);
      setError(describeAuthError(err));
      setLoading(false);
    }
  }

  async function handleGoogleClick() {
    setError(null);
    setLoading(true);
    try {
      const credential: UserCredential = await signInWithPopup(auth, new GoogleAuthProvider());
      const idTokenResult = await credential.user.getIdTokenResult();

      if (!idTokenResult.claims.clinicId) {
        // Brand-new Google sign-in, no clinic attached yet — ask for a
        // clinic name before provisioning (see provisionGoogleClinicAction).
        setStage({
          name: "google-clinic-name",
          idToken: await credential.user.getIdToken(),
          suggestedName: "",
        });
        setLoading(false);
        return;
      }

      await proceedAfterPrimaryAuth(await credential.user.getIdToken());
    } catch (err) {
      console.error(err);
      setError(describeAuthError(err));
      setLoading(false);
    }
  }

  async function handleGoogleClinicNameSubmit(e: FormEvent) {
    e.preventDefault();
    if (stage.name !== "google-clinic-name") return;
    setError(null);
    setLoading(true);
    try {
      const result = await provisionGoogleClinicAction(stage.idToken, clinicName);
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      // Custom claims were just set server-side — the token already held by
      // the client is stale until force-refreshed.
      if (!auth.currentUser) throw new Error("Session was lost — please try signing in again.");
      const freshIdToken = await auth.currentUser.getIdToken(true);
      await proceedAfterPrimaryAuth(freshIdToken);
    } catch (err) {
      console.error(err);
      setError("Something went wrong setting up your clinic. Please try again.");
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault();
    if (stage.name !== "otp") return;
    setError(null);
    setLoading(true);
    try {
      const result = await finishAfterOtp(stage.idToken, otp, router, searchParams.get("next"));
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong verifying your code. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      {/* Soft glowing pastel lights, top of the page — a nod to "Radiance."
          Purely decorative: aria-hidden, and pointer-events-none so it never
          gets in the way of the form below it. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[440px] overflow-hidden">
        {/* Horizontal placement uses margin-left (in px), not a translate-x
            utility — the glow-drift keyframe below sets `transform` directly
            for the wobble, and a CSS animation owns the whole `transform`
            property for its duration, so any translate-x baked in via a
            utility class would get silently discarded the instant the
            animation started, bunching every blob back to center. */}
        <div
          className="animate-glow-in absolute left-1/2 top-[-200px] h-[420px] w-[420px] rounded-full bg-gold-100 blur-3xl"
          style={{ animationDelay: "0s", marginLeft: "-357px" }}
        />
        <div
          className="animate-glow-in absolute left-1/2 top-[-160px] h-[380px] w-[380px] rounded-full bg-rose-200/70 blur-3xl"
          style={{ animationDelay: "-5s", marginLeft: "-38px" }}
        />
        <div
          className="animate-glow-in absolute left-1/2 top-[-220px] h-[440px] w-[440px] rounded-full bg-violet-200/60 blur-3xl"
          style={{ animationDelay: "-10s", marginLeft: "88px" }}
        />
        <div
          className="animate-glow-in absolute left-1/2 top-[-140px] h-[360px] w-[360px] rounded-full bg-sky-200/60 blur-3xl"
          style={{ animationDelay: "-7s", marginLeft: "-504px" }}
        />
        <div
          className="animate-glow-in absolute left-1/2 top-[-180px] h-[340px] w-[340px] rounded-full bg-emerald-100/60 blur-3xl"
          style={{ animationDelay: "-12s", marginLeft: "220px" }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl bg-surface p-8 shadow-card ring-1 ring-beige-300">
        <Image src="/logo.png" alt="" width={56} height={56} className="mx-auto" />
        <h1 className="mt-3 text-center font-display text-3xl font-medium text-brown-900">
          RadianceLaser
        </h1>
        <div className="mx-auto mt-3 mb-5 h-[2px] w-10 bg-gold-500" />

        {stage.name === "credentials" && (
          <>
            <p className="mb-7 text-center text-sm text-brown-600">
              Sign in to your clinic&apos;s portal
            </p>

            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-beige-300 bg-surface py-2.5 text-sm font-semibold text-brown-700 transition-colors hover:border-gold-500 hover:text-gold-600 disabled:opacity-60"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-brown-400">
              <div className="h-px flex-1 bg-beige-300" />
              or
              <div className="h-px flex-1 bg-beige-300" />
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-brown-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none transition-colors focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-brown-700">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none transition-colors focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                />
              </div>

              {error && <p className="text-sm text-red-700">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-brown-900 py-2.5 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
          </>
        )}

        {stage.name === "google-clinic-name" && (
          <>
            <p className="mb-7 text-center text-sm text-brown-600">
              Almost there — name your clinic to finish setting up your account.
            </p>
            <form onSubmit={handleGoogleClinicNameSubmit} className="space-y-4">
              <div>
                <label htmlFor="clinicName" className="mb-1.5 block text-sm font-medium text-brown-700">
                  Clinic Name
                </label>
                <input
                  id="clinicName"
                  type="text"
                  required
                  autoFocus
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="e.g. Advanced Skin Clinic"
                  className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none transition-colors focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                />
              </div>

              {error && <p className="text-sm text-red-700">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-brown-900 py-2.5 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
              >
                {loading ? "Setting up your clinic…" : "Continue"}
              </button>
            </form>
          </>
        )}

        {stage.name === "otp" && (
          <>
            <p className="mb-7 text-center text-sm text-brown-600">
              Enter the 6-digit code we just emailed you.
            </p>
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div>
                <label htmlFor="otp" className="mb-1.5 block text-sm font-medium text-brown-700">
                  Sign-in code
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  autoFocus
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-center text-lg tracking-[0.5em] text-brown-900 outline-none transition-colors focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                />
              </div>

              {error && <p className="text-sm text-red-700">{error}</p>}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full rounded-md bg-brown-900 py-2.5 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
              >
                {loading ? "Verifying…" : "Verify & Sign In"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStage({ name: "credentials" });
                  setOtp("");
                  setError(null);
                }}
                className="w-full text-center text-sm font-medium text-brown-600 hover:text-gold-600"
              >
                Back to sign in
              </button>
            </form>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.27-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03l3.05-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97l3.05 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}

// Turns a raw Firebase Auth error into something specific and actionable,
// instead of a single generic message for every possible failure. The full
// error is always logged to the console too (see the catch block above) for
// anything not covered here.
function describeAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error — check your connection and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";
    case "auth/operation-not-allowed":
      return "That sign-in method isn't enabled for this Firebase project yet " +
        "(Firebase Console → Authentication → Sign-in method).";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid":
      return "Firebase client config looks wrong — double-check the NEXT_PUBLIC_FIREBASE_* " +
        "values in .env.local match your Firebase project.";
    default:
      return code
        ? `Sign-in failed (${code}). Check the browser console for details.`
        : "Something went wrong signing in. Check the browser console for details.";
  }
}
