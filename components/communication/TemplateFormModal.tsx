"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createTemplateAction } from "@/app/dashboard/communication/actions";
import { TEMPLATE_VARIABLE_LABELS } from "@/types";
import type { MessageTemplate, MessageTemplateCategory } from "@/types";

const CATEGORY_OPTIONS: { value: MessageTemplateCategory; label: string }[] = [
  { value: "appointment_reminder", label: "Appointment Reminder" },
  { value: "appointment_confirmation", label: "Appointment Confirmation" },
  { value: "receipt_sent", label: "Receipt Sent" },
  { value: "visit_feedback", label: "Post-Visit Feedback" },
  { value: "custom", label: "Custom" },
];

export default function TemplateFormModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (template: MessageTemplate) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<MessageTemplateCategory>("appointment_reminder");
  const [customVariableLabels, setCustomVariableLabels] = useState<string[]>([]);
  const [bodyPreview, setBodyPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fixedLabels = category === "custom" ? null : TEMPLATE_VARIABLE_LABELS[category];

  function addCustomVariable() {
    setCustomVariableLabels((prev) => [...prev, ""]);
  }

  function updateCustomVariable(i: number, value: string) {
    setCustomVariableLabels((prev) => prev.map((v, idx) => (idx === i ? value : v)));
  }

  function removeCustomVariable(i: number) {
    setCustomVariableLabels((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    const result = await createTemplateAction({
      name: name.trim(),
      category,
      variableLabels: category === "custom" ? customVariableLabels.filter((v) => v.trim()) : [],
      bodyPreview: bodyPreview.trim() || undefined,
    });
    setSaving(false);
    if (result.error || !result.template) {
      setError(result.error || "Something went wrong. Please try again.");
      return;
    }
    onCreated(result.template);
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
            <label className="text-sm font-medium text-brown-700">Template Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Must exactly match the name approved on BhashSMS/Meta"
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

          {fixedLabels ? (
            <div>
              <label className="text-sm font-medium text-brown-700">Variables (fixed for this category)</label>
              <p className="mt-1 text-xs text-brown-400">
                The app fills these in automatically, in this order, when it sends this kind of message:{" "}
                {fixedLabels.join(" → ")}. The template approved on BhashSMS/Meta needs its {"{{1}}"},{" "}
                {"{{2}}"}, … placeholders in this same order.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-brown-700">Variables</label>
                <button
                  type="button"
                  onClick={addCustomVariable}
                  className="text-xs font-medium text-gold-600 hover:underline"
                >
                  + Add variable
                </button>
              </div>
              <p className="mt-1 text-xs text-brown-400">
                Custom templates aren't sent automatically anywhere yet — this is just a record of what each
                placeholder means, for your own reference.
              </p>
              <div className="mt-2 space-y-2">
                {customVariableLabels.map((label, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={label}
                      onChange={(e) => updateCustomVariable(i, e.target.value)}
                      placeholder={`What does {{${i + 1}}} mean?`}
                      className="flex-1 rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomVariable(i)}
                      className="flex-shrink-0 text-xs font-medium text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-brown-700">
              Wording <span className="text-brown-400">(optional, for your reference only)</span>
            </label>
            <textarea
              value={bodyPreview}
              onChange={(e) => setBodyPreview(e.target.value)}
              rows={3}
              placeholder="e.g. Hi {{1}}, this is a reminder for your appointment on {{2}} at {{3}}."
              className="mt-1 w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500"
            />
            <p className="mt-1 text-xs text-brown-400">
              Not sent anywhere — just a note so staff can recognize which template this is. The real wording lives
              on your BhashSMS/Meta account.
            </p>
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSubmit}
              disabled={saving || !name.trim()}
              className="rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Template"}
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
