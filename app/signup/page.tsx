"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { createTrialClinicAction } from "./actions";
import { ANNUAL_PRICE_INR, TRIAL_LENGTH_DAYS } from "@/lib/subscription";

export default function SignUpPage() {
  const router = useRouter();
  const [clinicName, setClinicName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

      // Step 2: sign in client-side with the same credentials, then
      // exchange for a session cookie — identical to app/login/page.tsx,
      // so there's one tested path from "signed in" to "has a session".
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();

      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error("Could not start a session. Please try again.");

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Something went wrong signing you in. Please try logging in instead.");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      {/* Same decorative glow treatment as /login — one continuous visual
          identity from marketing through to the product itself. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[440px] overflow-hidden">
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
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm rounded-xl bg-surface p-8 shadow-card ring-1 ring-beige-300">
          <Link href="/" className="block text-center">
            <h1 className="font-display text-3xl font-medium text-brown-900">RadianceLaser</h1>
          </Link>
          <div className="mx-auto mt-3 mb-2 h-[2px] w-10 bg-gold-500" />
          <p className="mb-2 text-center text-sm text-brown-600">Start your free trial</p>
          <p className="mb-7 text-center text-xs text-brown-400">
            Free for {Math.round(TRIAL_LENGTH_DAYS / 30)} months, then ₹{ANNUAL_PRICE_INR.toLocaleString("en-IN")}/year.
            No card required to start.
          </p>

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
        </div>
      </div>
    </div>
  );
}
