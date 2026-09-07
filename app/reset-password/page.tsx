"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import AuthShell from "@/components/marketing/AuthShell";

// Where the link app/forgot-password's sendPasswordResetEmail generates
// actually lands (its `url` + handleCodeInApp:true) — Firebase appends
// oobCode (and mode=resetPassword) as query params rather than routing
// through its own hosted page, so this reads and consumes that code
// directly instead of trusting anything else in the URL.
type Stage = "verifying" | "invalid" | "ready" | "done";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  const [stage, setStage] = useState<Stage>("verifying");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setStage("invalid");
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then((verifiedEmail) => {
        setEmail(verifiedEmail);
        setStage("ready");
      })
      .catch(() => setStage("invalid"));
  }, [oobCode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!oobCode) return;
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setStage("done");
    } catch (err) {
      console.error("Password reset failed:", err);
      setError("This link has expired or already been used. Request a new one.");
    }
    setLoading(false);
  }

  return (
    <AuthShell>
      <div className="w-full max-w-sm rounded-xl bg-surface p-8 shadow-card ring-1 ring-beige-300">
        <Image src="/logo.png" alt="" width={44} height={44} className="mx-auto lg:hidden" />
        <h1 className="mt-3 text-center font-logo text-2xl text-brown-900 lg:hidden">
          Radiance <span className="text-gold-600">Laser</span>
        </h1>
        <div className="mx-auto mt-3 mb-5 h-[2px] w-10 bg-gold-500 lg:hidden" />

        {stage === "verifying" && <p className="text-center text-sm text-brown-600">Checking your link…</p>}

        {stage === "invalid" && (
          <>
            <p className="mb-2 text-center text-sm font-medium text-brown-900">This link is invalid or expired</p>
            <p className="text-center text-sm text-brown-600">Request a new password reset link and try again.</p>
            <Link
              href="/forgot-password"
              className="mt-6 block text-center text-sm font-medium text-gold-600 hover:underline"
            >
              Request a new link
            </Link>
          </>
        )}

        {stage === "ready" && (
          <>
            <p className="mb-7 text-center text-sm text-brown-600">
              Set a new password for <span className="font-medium">{email}</span>.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-brown-700">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoFocus
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
                {loading ? "Saving…" : "Reset password"}
              </button>
            </form>
          </>
        )}

        {stage === "done" && (
          <>
            <p className="mb-2 text-center text-sm font-medium text-brown-900">Password updated</p>
            <p className="mb-6 text-center text-sm text-brown-600">You can now sign in with your new password.</p>
            <button
              onClick={() => router.push("/login")}
              className="w-full rounded-md bg-brown-900 py-2.5 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
            >
              Sign in
            </button>
          </>
        )}
      </div>
    </AuthShell>
  );
}
