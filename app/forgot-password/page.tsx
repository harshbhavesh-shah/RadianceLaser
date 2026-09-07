"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import AuthShell from "@/components/marketing/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // The link Firebase emails lands on our own /reset-password (see
      // handleCodeInApp below) instead of a generic Firebase-hosted page —
      // that page reads the oobCode itself and calls confirmPasswordReset.
      await sendPasswordResetEmail(auth, email.trim().toLowerCase(), {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      });
    } catch (err) {
      // Deliberately shown even on auth/user-not-found — confirming which
      // emails have accounts would let anyone enumerate your clinic list.
      // Only a genuinely malformed address gets its own message.
      const code = (err as { code?: string })?.code;
      if (code === "auth/invalid-email") {
        setError("Enter a valid email address.");
        setLoading(false);
        return;
      }
      console.error("Password reset request failed:", err);
    }
    setLoading(false);
    setSent(true);
  }

  return (
    <AuthShell>
      <div className="w-full max-w-sm rounded-xl bg-surface p-8 shadow-card ring-1 ring-beige-300">
        <Image src="/logo.png" alt="" width={44} height={44} className="mx-auto lg:hidden" />
        <h1 className="mt-3 text-center font-logo text-2xl text-brown-900 lg:hidden">
          Radiance <span className="text-gold-600">Laser</span>
        </h1>
        <div className="mx-auto mt-3 mb-5 h-[2px] w-10 bg-gold-500 lg:hidden" />

        {sent ? (
          <>
            <p className="mb-2 text-center text-sm font-medium text-brown-900">Check your email</p>
            <p className="text-center text-sm text-brown-600">
              If an account exists for <span className="font-medium">{email}</span>, we've sent a link to reset
              your password. It expires in an hour.
            </p>
            <Link
              href="/login"
              className="mt-6 block text-center text-sm font-medium text-gold-600 hover:underline"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="mb-7 text-center text-sm text-brown-600">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-brown-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none transition-colors focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                />
              </div>

              {error && <p className="text-sm text-red-700">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-brown-900 py-2.5 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-brown-600">
              <Link href="/login" className="font-medium text-gold-600 hover:underline">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthShell>
  );
}
