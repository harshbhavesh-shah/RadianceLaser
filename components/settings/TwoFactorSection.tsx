"use client";

import { useState, type FormEvent } from "react";
import {
  startTotpEnrollmentAction,
  confirmTotpEnrollmentAction,
  disableTwoFactorAction,
  type TotpEnrollmentResult,
} from "@/app/dashboard/settings/actions";

const codeInputClass =
  "w-40 rounded-[10px] border border-beige-300 bg-[#FCFAF7] px-3.5 py-2.5 text-center text-lg tracking-[0.4em] text-brown-900 outline-none transition-colors focus:border-rust-600/50";
const primaryBtn =
  "rounded-lg bg-rust-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-rust-700 disabled:opacity-60";
const ghostBtn = "px-2 py-2 text-sm font-bold text-brown-400 hover:text-rust-600";

type Mode = "idle" | "enrolling" | "disabling";

/** Lets a signed-in staff member turn authenticator-app (TOTP) 2FA on/off for
 * their own account — see lib/auth/totp.ts and app/login/actions.ts
 * verifyLoginTwoFactorAction for how the code gate works at sign-in.
 * Deliberately not owner-gated: this is a personal security preference, not
 * a clinic-wide setting. `initialEnabled` without `initialHasAuthenticator`
 * is a legacy email-code account, offered the switch to an app. */
export default function TwoFactorSection({
  initialEnabled,
  initialHasAuthenticator,
}: {
  initialEnabled: boolean;
  initialHasAuthenticator: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [hasAuthenticator, setHasAuthenticator] = useState(initialHasAuthenticator);
  const [mode, setMode] = useState<Mode>("idle");
  const [enrollment, setEnrollment] = useState<TotpEnrollmentResult | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode("idle");
    setEnrollment(null);
    setCode("");
    setError(null);
  }

  async function handleStart() {
    setBusy(true);
    setError(null);
    const res = await startTotpEnrollmentAction();
    setBusy(false);
    if (res.error) return setError(res.error);
    setEnrollment(res);
    setMode("enrolling");
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    if (!enrollment?.ticket) return;
    setBusy(true);
    setError(null);
    const res = await confirmTotpEnrollmentAction(enrollment.ticket, code);
    setBusy(false);
    if (res.error) {
      setCode("");
      return setError(res.error);
    }
    setEnabled(true);
    setHasAuthenticator(true);
    reset();
  }

  async function handleDisable(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await disableTwoFactorAction(code);
    setBusy(false);
    if (res.error) {
      setCode("");
      return setError(res.error);
    }
    setEnabled(false);
    setHasAuthenticator(false);
    reset();
  }

  const isLegacy = enabled && !hasAuthenticator;

  return (
    <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
      <h2 className="font-display text-lg font-medium text-brown-900">Two-Factor Sign-In</h2>
      <p className="mt-1 text-sm text-brown-600">
        Adds a second step at sign-in: a 6-digit code from an authenticator app on your phone (Google
        Authenticator, Microsoft Authenticator, Authy, 1Password…), on top of your password.
      </p>

      {mode === "idle" && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-brown-900">
            {hasAuthenticator
              ? "On: authenticator app required at sign-in"
              : isLegacy
                ? "On: emailed code (older method)"
                : "Off"}
          </span>
          {!hasAuthenticator && (
            <button onClick={handleStart} disabled={busy} className={primaryBtn}>
              {busy ? "Starting…" : isLegacy ? "Switch to authenticator app" : "Set up authenticator app"}
            </button>
          )}
          {enabled && (
            <button
              onClick={() => {
                setError(null);
                if (hasAuthenticator) setMode("disabling");
                else void handleDisable({ preventDefault() {} } as FormEvent);
              }}
              disabled={busy}
              className={ghostBtn}
            >
              Turn off
            </button>
          )}
        </div>
      )}

      {mode === "enrolling" && enrollment?.qrCode && (
        <form onSubmit={handleConfirm} className="mt-4 space-y-3">
          <p className="text-sm text-brown-600">1. Scan this QR code with your authenticator app.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrollment.qrCode} alt="QR code for your authenticator app" className="h-44 w-44" />
          <p className="text-xs text-brown-400">
            Can&apos;t scan? Enter this key manually:{" "}
            <span className="break-all font-mono text-brown-700">{enrollment.secret}</span>
          </p>
          <p className="text-sm text-brown-600">2. Enter the 6-digit code it shows.</p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            placeholder="000000"
            aria-label="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={codeInputClass}
          />
          <div className="flex items-center gap-2">
            <button type="submit" disabled={busy || code.length !== 6} className={primaryBtn}>
              {busy ? "Verifying…" : "Turn on"}
            </button>
            <button type="button" onClick={reset} className={ghostBtn}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === "disabling" && (
        <form onSubmit={handleDisable} className="mt-4 space-y-3">
          <p className="text-sm text-brown-600">Enter a current code from your authenticator app to turn this off.</p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            placeholder="000000"
            aria-label="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={codeInputClass}
          />
          <div className="flex items-center gap-2">
            <button type="submit" disabled={busy || code.length !== 6} className={primaryBtn}>
              {busy ? "Checking…" : "Turn off"}
            </button>
            <button type="button" onClick={reset} className={ghostBtn}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
