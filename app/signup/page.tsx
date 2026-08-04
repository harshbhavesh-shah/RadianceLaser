"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { createTrialClinicAction } from "./actions";
import { provisionGoogleClinicAction } from "@/app/login/actions";
import { proceedAfterPrimaryAuth, finishAfterOtp } from "@/lib/authFlow";
import { ANNUAL_PRICE_INR, TRIAL_LENGTH_DAYS } from "@/lib/subscription";

// form: the normal clinic-name/owner-name/email/password form (or "click
//   Google").
// google-clinic-name: a Google account signed in for the first time (no
//   clinicId claim yet) — needs a clinic name before it can be provisioned.
// otp: primary auth succeeded (password or an existing Google account
//   landing here by mistake) and that account has 2FA on — see
//   lib/authFlow.ts for why this is shared with /login rather than
//   reimplemented here.
type Stage =
  | { name: "form" }
  | { name: "google-clinic-name"; idToken: string }
  | { name: "otp"; idToken: string };

export default function SignUpPage() {
  const router = useRouter();
  const [clinicName, setClinicName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<Stage>({ name: "form" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function afterPrimaryAuth(idToken: string) {
    const outcome = await proceedAfterPrimaryAuth(idToken, router, null);
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Step 1: create the clinic + owner account server-side (needs the
      // Admin SDK to set custom claims — see app/signup/actions.ts).
      const result = await createTrialClinicAction({ clinicName, ownerName, email, password });
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      // Step 2: sign in client-side with the same credentials, then run
      // through the same primary-auth flow /login uses (a brand-new signup
      // won't have 2FA on yet, but this keeps exactly one code path for
      // "authenticated, now what").
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await afterPrimaryAuth(await credential.user.getIdToken());
    } catch (err) {
      console.error(err);
      setError("Something went wrong signing you in. Please try logging in instead.");
      setLoading(false);
    }
  }

  async function handleGoogleClick() {
    setError(null);
    setLoading(true);
    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      const idTokenResult = await credential.user.getIdTokenResult();

      if (!idTokenResult.claims.clinicId) {
        setStage({ name: "google-clinic-name", idToken: await credential.user.getIdToken() });
        setLoading(false);
        return;
      }

      // This Google account already has a clinic — someone who already
      // signed up landed on /signup again. Treat it as an ordinary login
      // rather than erroring, including the 2FA gate if they have it on.
      await afterPrimaryAuth(await credential.user.getIdToken());
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
      if (!auth.currentUser) throw new Error("Session was lost — please try again.");
      const freshIdToken = await auth.currentUser.getIdToken(true);
      await afterPrimaryAuth(freshIdToken);
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
      const result = await finishAfterOtp(stage.idToken, otp, router, null);
      if (result.error) {
        setError(result.error);
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong verifying your code. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      {/* Same decorative glow treatment as /login — one continuous visual
          identity from marketing through to the product itself. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[440px] overflow-hidden">
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
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-xl bg-surface p-8 shadow-card ring-1 ring-beige-300">
          <Link href="/" className="block text-center">
            <h1 className="font-display text-3xl font-medium text-brown-900">RadianceLaser</h1>
          </Link>
          <div className="mx-auto mt-3 mb-2 h-[2px] w-10 bg-gold-500" />

          {stage.name === "form" && (
            <>
              <p className="mb-2 text-center text-sm text-brown-600">Start your free trial</p>
              <p className="mb-7 text-center text-xs text-brown-400">
                Free for {Math.round(TRIAL_LENGTH_DAYS / 30)} months, then ₹
                {ANNUAL_PRICE_INR.toLocaleString("en-IN")}/year. No card required to start.
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

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="clinicName" className="mb-1.5 block text-sm font-medium text-brown-700">
                    Clinic Name
                  </label>
                  <input
                    id="clinicName"
                    type="text"
                    required
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="e.g. Advanced Skin Clinic"
                    className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none transition-colors focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                  />
                </div>

                <div>
                  <label htmlFor="ownerName" className="mb-1.5 block text-sm font-medium text-brown-700">
                    Your Name
                  </label>
                  <input
                    id="ownerName"
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none transition-colors focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                  />
                </div>

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
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none transition-colors focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                  />
                  <p className="mt-1 text-xs text-brown-400">At least 8 characters.</p>
                </div>

                {error && <p className="text-sm text-red-700">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md bg-brown-900 py-2.5 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
                >
                  {loading ? "Setting up your clinic…" : "Start Free Trial"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-brown-600">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-gold-600 hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}

          {stage.name === "google-clinic-name" && (
            <>
              <p className="mb-7 text-center text-sm text-brown-600">
                Almost there — name your clinic to finish setting up your account.
              </p>
              <form onSubmit={handleGoogleClinicNameSubmit} className="space-y-4">
                <div>
                  <label htmlFor="googleClinicName" className="mb-1.5 block text-sm font-medium text-brown-700">
                    Clinic Name
                  </label>
                  <input
                    id="googleClinicName"
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
                  <label htmlFor="signupOtp" className="mb-1.5 block text-sm font-medium text-brown-700">
                    Sign-in code
                  </label>
                  <input
                    id="signupOtp"
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

function describeAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";
    case "auth/network-request-failed":
      return "Network error — check your connection and try again.";
    default:
      return code
        ? `Sign-in failed (${code}). Check the browser console for details.`
        : "Something went wrong signing in. Check the browser console for details.";
  }
}
