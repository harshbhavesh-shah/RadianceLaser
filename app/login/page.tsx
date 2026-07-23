"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Step 1: sign in with Firebase Auth directly from the browser.
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();

      // Step 2: exchange that ID token for a secure HttpOnly session cookie.
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        throw new Error("Could not start a session. Please try again.");
      }

      const next = searchParams.get("next") || "/dashboard";
      router.push(next);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(describeAuthError(err));
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
          className="animate-glow-drift absolute left-1/2 top-[-200px] h-[420px] w-[420px] rounded-full bg-gold-100 blur-3xl"
          style={{ animationDelay: "0s", marginLeft: "-357px" }}
        />
        <div
          className="animate-glow-drift absolute left-1/2 top-[-160px] h-[380px] w-[380px] rounded-full bg-rose-200/70 blur-3xl"
          style={{ animationDelay: "-5s", marginLeft: "-38px" }}
        />
        <div
          className="animate-glow-drift absolute left-1/2 top-[-220px] h-[440px] w-[440px] rounded-full bg-violet-200/60 blur-3xl"
          style={{ animationDelay: "-10s", marginLeft: "88px" }}
        />
        <div
          className="animate-glow-drift absolute left-1/2 top-[-140px] h-[360px] w-[360px] rounded-full bg-sky-200/60 blur-3xl"
          style={{ animationDelay: "-7s", marginLeft: "-504px" }}
        />
        <div
          className="animate-glow-drift absolute left-1/2 top-[-180px] h-[340px] w-[340px] rounded-full bg-emerald-100/60 blur-3xl"
          style={{ animationDelay: "-12s", marginLeft: "220px" }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl bg-surface p-8 shadow-card ring-1 ring-beige-300">
        <h1 className="text-center font-display text-3xl font-medium text-brown-900">
          RadianceLaser
        </h1>
        <div className="mx-auto mt-3 mb-5 h-[2px] w-10 bg-gold-500" />
        <p className="mb-7 text-center text-sm text-brown-600">
          Sign in to your clinic&apos;s portal
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
      </div>
      </div>
    </div>
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
    case "auth/operation-not-allowed":
      return "Email/Password sign-in isn't enabled for this Firebase project yet " +
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
