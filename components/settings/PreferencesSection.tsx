"use client";

import { useState } from "react";
import { updateStatsWindow } from "@/app/dashboard/settings/actions";
import type { StatsWindow } from "@/types";

const WINDOW_OPTIONS: { value: StatsWindow; label: string; description: string }[] = [
  { value: "today", label: "Today", description: "Same-day snapshot — resets each morning." },
  { value: "week", label: "This Week", description: "Rolling totals since the start of the week." },
  { value: "month", label: "This Month", description: "Rolling totals for the current calendar month." },
];

export default function PreferencesSection({
  initialWindow,
  isOwner,
}: {
  initialWindow: StatsWindow;
  isOwner: boolean;
}) {
  const [statsWindow, setStatsWindow] = useState<StatsWindow>(initialWindow);
  const [saving, setSaving] = useState<StatsWindow | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(value: StatsWindow) {
    if (!isOwner || value === statsWindow) return;
    setSaving(value);
    setError(null);
    const res = await updateStatsWindow(value);
    setSaving(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setStatsWindow(value);
  }

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <h2 className="font-display text-lg font-medium text-brown-900">Dashboard Preferences</h2>
      <p className="mt-1 text-sm text-brown-600">
        Controls the time window used for the stat cards on the Overview page.
      </p>

      <div className="mt-4 space-y-2">
        {WINDOW_OPTIONS.map((opt) => {
          const isSelected = statsWindow === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => handleChange(opt.value)}
              disabled={!isOwner || saving !== null}
              className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-default ${
                isSelected
                  ? "border-gold-500 bg-gold-100/40"
                  : "border-beige-300 enabled:hover:bg-beige-200/40"
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                  isSelected ? "border-gold-500 bg-gold-500" : "border-beige-300"
                }`}
              >
                {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <span>
                <div className="text-sm font-medium text-brown-900">
                  {opt.label} {saving === opt.value && "· Saving…"}
                </div>
                <div className="text-xs text-brown-400">{opt.description}</div>
              </span>
            </button>
          );
        })}
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {!isOwner && (
        <p className="mt-3 text-xs text-brown-400">Only the clinic owner can change this.</p>
      )}
    </div>
  );
}
