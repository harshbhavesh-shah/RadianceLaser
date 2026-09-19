"use client";

import { Suspense, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword, type UserCredential } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { provisionGoogleClinicAction } from "./actions";
import {
  proceedAfterPrimaryAuth as sharedProceedAfterPrimaryAuth,
  finishAfterOtp,
  signInWithGoogle,
} from "@/lib/authFlow";

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
      const credential: UserCredential = await signInWithGoogle();
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
      if (!auth.currentUser) throw new Error("Session was lost. Please try signing in again.");
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-canvas px-4 py-12">
      <Link href="/" className="flex items-center gap-2.5">
        <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8 flex-shrink-0 rounded-lg" />
        <span className="text-xl font-extrabold text-brown-900">
          Radiance <span className="text-rust-600">Laser</span>
        </span>
      </Link>

      <div className="w-full max-w-[440px] rounded-[20px] bg-surface p-9 py-10 shadow-soft">
        {stage.name === "credentials" && (
          <>
            <p className="text-center text-[19px] font-bold text-brown-900">
              Sign in to your clinic&apos;s portal
            </p>

            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={loading}
              className="mt-[22px] flex w-full items-center justify-center gap-2.5 rounded-xl border border-beige-300 bg-surface py-3.5 text-[15px] font-bold text-brown-900 transition-colors hover:bg-beige-100/60 disabled:opacity-60"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="my-[22px] flex items-center gap-3">
              <div className="h-px flex-1 bg-beige-300" />
              <span className="text-[13px] font-semibold text-brown-400">or</span>
              <div className="h-px flex-1 bg-beige-300" />
            </div>

            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-[22px]">
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-sm font-bold text-brown-900">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-[10px] border border-beige-300 bg-[#FCFAF7] px-3.5 py-[13px] text-sm text-brown-900 outline-none transition-colors focus:border-rust-600/50"
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-bold text-brown-900">
                    Password
                  </label>
                  <Link href="/forgot-password" className="text-[13px] font-bold text-rust-600 hover:text-rust-700">
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-[10px] border border-beige-300 bg-[#FCFAF7] px-3.5 py-[13px] text-sm text-brown-900 outline-none transition-colors focus:border-rust-600/50"
                />
              </div>

              {error && <p className="text-sm text-red-700">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 w-full rounded-xl bg-rust-600 py-[15px] text-[15px] font-bold text-white transition-colors hover:bg-rust-700 disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>
          </>
        )}

        {stage.name === "google-clinic-name" && (
          <>
            <p className="text-center text-[19px] font-bold text-brown-900">
              Almost there. Name your clinic to finish setting up your account.
            </p>
            <form onSubmit={handleGoogleClinicNameSubmit} className="mt-[22px] flex flex-col gap-[22px]">
              <div className="flex flex-col gap-2">
                <label htmlFor="clinicName" className="text-sm font-bold text-brown-900">
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
                  className="w-full rounded-[10px] border border-beige-300 bg-[#FCFAF7] px-3.5 py-[13px] text-sm text-brown-900 outline-none transition-colors focus:border-rust-600/50"
                />
              </div>

              {error && <p className="text-sm text-red-700">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-rust-600 py-[15px] text-[15px] font-bold text-white transition-colors hover:bg-rust-700 disabled:opacity-60"
              >
                {loading ? "Setting up your clinic…" : "Continue"}
              </button>
            </form>
          </>
        )}

        {stage.name === "otp" && (
          <>
            <p className="text-center text-[19px] font-bold text-brown-900">
              Enter the 6-digit code we just emailed you.
            </p>
            <form onSubmit={handleOtpSubmit} className="mt-[22px] flex flex-col gap-[22px]">
              <div className="flex flex-col gap-2">
                <label htmlFor="otp" className="text-sm font-bold text-brown-900">
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
                  className="w-full rounded-[10px] border border-beige-300 bg-[#FCFAF7] px-3.5 py-[13px] text-center text-lg tracking-[0.5em] text-brown-900 outline-none transition-colors focus:border-rust-600/50"
                />
              </div>

              {error && <p className="text-sm text-red-700">{error}</p>}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full rounded-xl bg-rust-600 py-[15px] text-[15px] font-bold text-white transition-colors hover:bg-rust-700 disabled:opacity-60"
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
                className="w-full text-center text-sm font-bold text-brown-400 hover:text-rust-600"
              >
                Back to sign in
              </button>
            </form>
          </>
        )}
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
      return "Network error. Check your connection and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";
    case "auth/operation-not-allowed":
      return "That sign-in method isn't enabled for this Firebase project yet " +
        "(Firebase Console → Authentication → Sign-in method).";
    case "auth/invalid-api-key":
    case "auth/api-key-not-valid":
      return "Firebase client config looks wrong. Double-check the NEXT_PUBLIC_FIREBASE_* " +
        "values in .env.local match your Firebase project.";
    default:
      return code
        ? `Sign-in failed (${code}). Check the browser console for details.`
        : "Something went wrong signing in. Check the browser console for details.";
  }
}
