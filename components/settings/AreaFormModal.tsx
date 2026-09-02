"use client";

import { useState } from "react";
import { createAreaDefAction, updateAreaDefAction } from "@/app/dashboard/settings/areaDefActions";
import type { AreaDef, SessionType } from "@/types";

const SESSION_TYPE_LABELS: Record<string, string> = { qs: "Q-Switch", lhr: "Laser Hair Removal" };

export default function AreaFormModal({
  editing,
  sessionType,
  onClose,
  onSaved,
}: {
  // undefined/null = creating a new area for `sessionType`.
  editing?: AreaDef | null;
  sessionType: SessionType;
  onClose: () => void;
  onSaved: (def: AreaDef) => void;
}) {
  const isEditing = !!editing;

  const [name, setName] = useState(editing?.name || "");
  const [duration, setDuration] = useState(
    editing?.defaultDurationMinutes ? String(editing.defaultDurationMinutes) : ""
  );
  const [gstApplicable, setGstApplicable] = useState(editing?.gstApplicable ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) return setError("Area name is required.");

    setSaving(true);
    setError(null);

    const fields = {
      name: trimmedName,
      defaultDurationMinutes: duration ? Math.max(0, Number(duration) || 0) : undefined,
      gstApplicable,
    };

    try {
      let saved: AreaDef;
      if (isEditing) {
        const result = await updateAreaDefAction(editing!.id, fields);
        if ("error" in result) {
          setError(result.error);
          setSaving(false);
          return;
        }
        saved = result.def;
      } else {
        const result = await createAreaDefAction({ sessionType, ...fields });
        if ("error" in result) {
          setError(result.error);
          setSaving(false);
          return;
        }
        saved = result.def;
      }
      onSaved(saved);
    } catch (err) {
      console.error("Failed to save treatment area:", err);
      setError("Couldn't save this treatment area. Please try again.");
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-card">
        <h2 className="font-display text-lg font-medium text-brown-900">
          {isEditing ? `Edit ${editing!.name}` : "Add Treatment Area"}
        </h2>
        <p className="mt-1 text-sm text-brown-400">
          For the {SESSION_TYPE_LABELS[sessionType] || sessionType} visit form&apos;s Area dropdown.
        </p>
        <div className="mb-5 mt-3 h-[2px] w-8 bg-gold-500" />

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">Area Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Full Face"
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">
              Default Duration (min) <span className="text-brown-400">(optional)</span>
            </label>
            <input
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 20"
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
            <p className="mt-1.5 text-xs text-brown-400">
              Suggests a total session duration on the visit form when this area is picked — staff
              can still edit it.
            </p>
          </div>

          <label className="flex items-start gap-2.5 rounded-md border border-beige-300 bg-canvas px-3 py-2.5">
            <input
              type="checkbox"
              checked={gstApplicable}
              onChange={(e) => setGstApplicable(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-beige-400 text-gold-600 focus:ring-gold-500"
            />
            <span className="text-sm text-brown-800">
              <span className="font-medium">GST applicable</span>
              <br />
              <span className="text-xs text-brown-400">
                Whether this treatment is subject to GST — this is your clinic&apos;s own call, and
                can vary area to area.
              </span>
            </span>
          </label>
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
            {saving ? "Saving…" : isEditing ? "Save Changes" : "Add Area"}
          </button>
        </div>
      </div>
    </div>
  );
}
