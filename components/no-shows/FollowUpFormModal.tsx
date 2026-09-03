"use client";

import { useState } from "react";
import { createNoShowFollowUpAction, updateNoShowFollowUpAction } from "@/app/dashboard/no-shows/actions";
import type { MessageTemplate, NoShowFollowUp, NoShowFollowUpKind } from "@/types";

const KIND_OPTIONS: { value: NoShowFollowUpKind; label: string; hint: string }[] = [
  { value: "survey", label: "Ask why they missed it", hint: "Sends a link to a short multiple-choice survey." },
  { value: "incentive", label: "Win-back incentive", hint: "Offers a discount to encourage rebooking." },
  { value: "reminder", label: "Reschedule reminder", hint: "A plain nudge to book again, no offer attached." },
  { value: "custom", label: "Custom", hint: "Whatever this clinic wants it to be." },
];

const DELAY_OPTIONS = [1, 2, 4, 6, 12, 24, 48, 72];

export default function FollowUpFormModal({
  editing,
  templates,
  onClose,
  onSaved,
}: {
  editing?: NoShowFollowUp | null;
  templates: MessageTemplate[]; // already filtered to category: "no_show_followup"
  onClose: () => void;
  onSaved: (followUp: NoShowFollowUp) => void;
}) {
  const isEditing = !!editing;

  const [name, setName] = useState(editing?.name || "");
  const [kind, setKind] = useState<NoShowFollowUpKind>(editing?.kind || "survey");
  const [templateId, setTemplateId] = useState(editing?.templateId || templates[0]?.id || "");
  const [offerText, setOfferText] = useState(editing?.offerText || "");
  const [delayHours, setDelayHours] = useState(editing?.delayHours ?? 4);
  const [enabled, setEnabled] = useState(editing?.enabled ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showOfferText = kind === "incentive" || kind === "custom";

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) return setError("Follow-up name is required.");
    if (!templateId) return setError("Pick a message template first.");

    setSaving(true);
    setError(null);

    const fields = {
      name: trimmedName,
      kind,
      templateId,
      offerText: showOfferText ? offerText.trim() || undefined : undefined,
      enabled,
      delayHours,
    };

    try {
      const result =
        isEditing && editing
          ? await updateNoShowFollowUpAction(editing.id, fields)
          : await createNoShowFollowUpAction(fields);
      if ("error" in result) {
        setError(result.error);
        setSaving(false);
        return;
      }
      onSaved(result.followUp);
    } catch (err) {
      console.error("Failed to save no-show follow-up:", err);
      setError("Couldn't save this follow-up. Please try again.");
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-surface p-6 shadow-card">
        <h2 className="font-display text-lg font-medium text-brown-900">
          {isEditing ? `Edit ${editing!.name}` : "New No Show Follow-Up"}
        </h2>
        <p className="mt-1 text-sm text-brown-400">
          Sent automatically over WhatsApp once a patient is marked (or auto-detected as) no show.
        </p>
        <div className="mb-5 mt-3 h-[2px] w-8 bg-gold-500" />

        {templates.length === 0 ? (
          <p className="rounded-md border border-dashed border-beige-300 px-3 py-4 text-center text-sm text-brown-400">
            Add a &quot;No Show Follow-Up&quot; message template in Communication settings first.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">Follow-Up Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ask why they missed it"
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">Type</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as NoShowFollowUpKind)}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              >
                {KIND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-brown-400">
                {KIND_OPTIONS.find((opt) => opt.value === kind)?.hint}
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">Message Template</label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {showOfferText && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brown-700">
                  {kind === "incentive" ? "Offer" : "Detail"}{" "}
                  <span className="text-brown-400">(fills the template&apos;s 2nd variable)</span>
                </label>
                <input
                  type="text"
                  value={offerText}
                  onChange={(e) => setOfferText(e.target.value)}
                  placeholder={kind === "incentive" ? "e.g. 15% off your next visit" : ""}
                  className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">Send</label>
              <select
                value={delayHours}
                onChange={(e) => setDelayHours(Number(e.target.value))}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              >
                {DELAY_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h < 24 ? `${h} hour${h === 1 ? "" : "s"}` : `${h / 24} day${h === 24 ? "" : "s"}`} after the
                    missed appointment
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2.5 rounded-md border border-beige-300 bg-canvas px-3 py-2.5">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-beige-400 text-gold-600 focus:ring-gold-500"
              />
              <span className="text-sm text-brown-800">Active</span>
            </label>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-brown-600 hover:bg-beige-200"
          >
            Cancel
          </button>
          {templates.length > 0 && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
            >
              {saving ? "Saving…" : isEditing ? "Save Changes" : "Create Follow-Up"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
