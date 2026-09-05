"use client";

import { useState, type FormEvent } from "react";
import { IndianRupee } from "lucide-react";
import { updatePlatformPriceAction } from "@/app/admin/actions";
import type { PlatformSettingsInfo } from "@/lib/db/platformSettings";

function formatUpdatedAt(ms: number): string {
  return new Date(ms).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PricingForm({ initialSettings }: { initialSettings: PlatformSettingsInfo }) {
  const [settings, setSettings] = useState(initialSettings);
  const [price, setPrice] = useState(String(initialSettings.annualPriceInr));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const parsed = Number(price);
    const result = await updatePlatformPriceAction(parsed);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setSettings({ annualPriceInr: parsed, updatedAt: Date.now(), updatedByEmail: settings.updatedByEmail });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="max-w-md rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="flex items-center gap-2">
        <IndianRupee size={16} className="text-gold-600" />
        <h2 className="font-display text-base font-medium text-brown-900">Annual Price</h2>
      </div>
      <p className="mt-1.5 text-sm text-brown-600">
        Currently ₹{settings.annualPriceInr.toLocaleString("en-IN")}/year.
      </p>
      {settings.updatedAt && (
        <p className="mt-0.5 text-xs text-brown-400">
          Last changed {formatUpdatedAt(settings.updatedAt)}
          {settings.updatedByEmail ? ` by ${settings.updatedByEmail}` : ""}.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-brown-700">New price (₹/year)</label>
          <input
            type="number"
            min={1}
            step={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !price.trim()}
          className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {saved && <p className="mt-3 text-sm text-green-700">Saved — live everywhere now.</p>}
    </div>
  );
}
