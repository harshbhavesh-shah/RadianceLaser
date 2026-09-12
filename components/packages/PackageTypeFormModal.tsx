"use client";

import { useState } from "react";
import { createPackageTypeDefAction, updatePackageTypeDefAction } from "@/app/dashboard/packages/actions";
import type { PackageTypeDef, SessionType } from "@/types";

export default function PackageTypeFormModal({
  editing,
  sessionType,
  sessionTypeLabel,
  onClose,
  onSaved,
}: {
  // undefined/null = creating a new package type for `sessionType`.
  editing?: PackageTypeDef | null;
  sessionType: SessionType;
  sessionTypeLabel: string;
  onClose: () => void;
  onSaved: (def: PackageTypeDef) => void;
}) {
  const isEditing = !!editing;

  const [name, setName] = useState(editing?.name || "");
  const [totalSessions, setTotalSessions] = useState(editing ? String(editing.totalSessions) : "");
  const [suggestedAmount, setSuggestedAmount] = useState(editing ? String(editing.suggestedAmount) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmedName = name.trim();
    const sessions = Number(totalSessions);
    const amount = Number(suggestedAmount);

    if (!trimmedName) return setError("Package name is required.");
    if (!sessions || sessions <= 0) return setError("Enter a valid number of sessions.");
    if (!amount || amount <= 0) return setError("Enter a valid suggested price.");

    setSaving(true);
    setError(null);

    const fields = { name: trimmedName, totalSessions: sessions, suggestedAmount: amount };

    try {
      let saved: PackageTypeDef;
      if (isEditing) {
        const result = await updatePackageTypeDefAction(editing!.id, fields);
        if ("error" in result) {
          setError(result.error);
          setSaving(false);
          return;
        }
        saved = result.def;
      } else {
        const result = await createPackageTypeDefAction({ sessionType, ...fields });
        if ("error" in result) {
          setError(result.error);
          setSaving(false);
          return;
        }
        saved = result.def;
      }
      onSaved(saved);
    } catch (err) {
      console.error("Failed to save package type:", err);
      setError("Couldn't save this package type. Please try again.");
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-card">
        <h2 className="font-display text-lg font-medium text-brown-900">
          {isEditing ? `Edit ${editing!.name}` : "Add Package Type"}
        </h2>
        <p className="mt-1 text-sm text-brown-400">For {sessionTypeLabel} packages.</p>
        <div className="mb-5 mt-3 h-[2px] w-8 bg-gold-500" />

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">Package Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bridal Package"
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">Total Sessions</label>
              <input
                type="number"
                min={1}
                value={totalSessions}
                onChange={(e) => setTotalSessions(e.target.value)}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">Suggested Price (₹)</label>
              <input
                type="number"
                min={0}
                value={suggestedAmount}
                onChange={(e) => setSuggestedAmount(e.target.value)}
                placeholder="e.g. 15000"
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>
          </div>
          <p className="text-xs text-brown-400">
            Staff can still change the sessions and price when they actually sell this to a patient. This
            just fills in a starting point.
          </p>
        </div>

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-brown-600 hover:bg-beige-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
          >
            {saving ? "Saving…" : isEditing ? "Save Changes" : "Add Package Type"}
          </button>
        </div>
      </div>
    </div>
  );
}
