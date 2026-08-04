"use client";

import { useState } from "react";
import { toggleTwoFactorAction } from "@/app/dashboard/settings/actions";

/** Lets a signed-in staff member turn email-OTP 2FA on/off for their own
 * account — see lib/twoFactor.ts and app/login/actions.ts
 * requestTwoFactorIfEnabledAction() for how the emailed-code gate actually
 * works at sign-in. Deliberately not owner-gated: this is a personal
 * security preference, not a clinic-wide setting. */
export default function TwoFactorSection({
  initialEnabled,
  email,
}: {
  initialEnabled: boolean;
  email: string;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    const next = !enabled;
    setSaving(true);
    setError(null);
    const res = await toggleTwoFactorAction(next);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setEnabled(next);
  }

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <h2 className="font-display text-lg font-medium text-brown-900">Two-Factor Sign-In</h2>
      <p className="mt-1 text-sm text-brown-600">
        When turned on, signing in also requires a 6-digit code emailed to <strong>{email}</strong>,
        on top of your password.
      </p>

      <button
        onClick={handleToggle}
        disabled={saving}
        className={`mt-4 flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-default ${
          enabled ? "border-gold-500 bg-gold-100/40" : "border-beige-300 enabled:hover:bg-beige-200/40"
        }`}
      >
        <span
          className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
            enabled ? "bg-gold-500" : "bg-beige-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-soft transition-all ${
              enabled ? "left-4.5" : "left-0.5"
            }`}
          />
        </span>
        <span className="text-sm font-medium text-brown-900">
          {saving ? "Saving…" : enabled ? "On — email code required at sign-in" : "Off"}
        </span>
      </button>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
