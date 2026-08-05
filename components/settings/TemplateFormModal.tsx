"use client";

import { useMemo, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { createTemplateAction } from "@/app/dashboard/settings/messaging/actions";
import type { MessageTemplateCategory, TemplateButton, TemplateButtonType } from "@/types";

const CATEGORY_OPTIONS: { value: MessageTemplateCategory; label: string }[] = [
  { value: "appointment_reminder", label: "Appointment Reminder" },
  { value: "appointment_confirmation", label: "Appointment Confirmation" },
  { value: "receipt_sent", label: "Receipt Sent" },
  { value: "custom", label: "Custom" },
];

const BUTTON_TYPE_OPTIONS: { value: TemplateButtonType; label: string }[] = [
  { value: "quick_reply", label: "Quick Reply" },
  { value: "call", label: "Call Clinic" },
  { value: "url", label: "Visit Link" },
];

/** {{1}}, {{2}}, ... in order of first appearance — Meta's template
 * variable syntax. Used to prompt for a human label per placeholder rather
 * than making the owner track numbers themselves. */
function extractVariableCount(body: string): number {
  const matches = body.match(/\{\{(\d+)\}\}/g) || [];
  const numbers = matches.map((m) => parseInt(m.replace(/\D/g, ""), 10));
  return numbers.length ? Math.max(...numbers) : 0;
}

export default function TemplateFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<MessageTemplateCategory>("appointment_reminder");
  const [body, setBody] = useState("Hi {{1}}, this is a reminder for your appointment on {{2}} at {{3}}.");
  const [variableLabels, setVariableLabels] = useState<string[]>(["Patient name", "Date", "Time"]);
  const [buttons, setButtons] = useState<TemplateButton[]>([{ type: "quick_reply", label: "Confirm" }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variableCount = useMemo(() => extractVariableCount(body), [body]);

  function updateVariableLabel(index: number, value: string) {
    setVariableLabels((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function addButton() {
    if (buttons.length >= 3) return;
    setButtons((prev) => [...prev, { type: "quick_reply", label: "" }]);
  }

  function updateButton(index: number, patch: Partial<TemplateButton>) {
    setButtons((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  function removeButton(index: number) {
    setButtons((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    const result = await createTemplateAction({
      name: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      category,
      language: "en",
      body,
      variableLabels: variableLabels.slice(0, variableCount),
      buttons: buttons.filter((b) => b.label.trim()),
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-medium text-brown-900">New Message Template</h3>
          <button onClick={onClose} className="rounded p-1 text-brown-400 hover:bg-beige-200 hover:text-brown-700">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-brown-700">Internal Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Appointment reminder"
              className="mt-1 w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-brown-700">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MessageTemplateCategory)}
              className="mt-1 w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-brown-700">Message Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500"
            />
            <p className="mt-1 text-xs text-brown-400">
              Use {"{{1}}"}, {"{{2}}"}, etc. as placeholders — they're filled in automatically when a message sends.
            </p>
          </div>

          {variableCount > 0 && (
            <div>
              <label className="text-sm font-medium text-brown-700">Placeholder Labels</label>
              <div className="mt-1 space-y-2">
                {Array.from({ length: variableCount }).map((_, i) => (
                  <input
                    key={i}
                    value={variableLabels[i] || ""}
                    onChange={(e) => updateVariableLabel(i, e.target.value)}
                    placeholder={`What does {{${i + 1}}} mean? e.g. "Patient name"`}
                    className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500"
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-brown-700">Buttons (up to 3)</label>
              {buttons.length < 3 && (
                <button
                  type="button"
                  onClick={addButton}
                  className="flex items-center gap-1 text-xs font-medium text-gold-600 hover:underline"
                >
                  <Plus size={12} /> Add button
                </button>
              )}
            </div>
            <div className="mt-2 space-y-2">
              {buttons.map((btn, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={btn.type}
                    onChange={(e) => updateButton(i, { type: e.target.value as TemplateButtonType })}
                    className="rounded-md border border-beige-300 bg-canvas px-2 py-2 text-xs text-brown-900 outline-none focus:border-gold-500"
                  >
                    {BUTTON_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={btn.label}
                    onChange={(e) => updateButton(i, { label: e.target.value })}
                    placeholder="Label"
                    maxLength={20}
                    className="flex-1 rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500"
                  />
                  {btn.type !== "quick_reply" && (
                    <input
                      value={btn.value || ""}
                      onChange={(e) => updateButton(i, { value: e.target.value })}
                      placeholder={btn.type === "call" ? "Phone number" : "URL"}
                      className="flex-1 rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeButton(i)}
                    className="flex-shrink-0 rounded p-1.5 text-brown-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSubmit}
              disabled={saving || !name.trim() || !body.trim()}
              className="rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-50"
            >
              {saving ? "Submitting…" : "Submit for Approval"}
            </button>
            <button onClick={onClose} className="text-sm font-medium text-brown-600 hover:underline">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
