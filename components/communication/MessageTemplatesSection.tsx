"use client";

import { useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { deleteTemplateAction, sendTestMessageAction } from "@/app/dashboard/communication/actions";
import TemplateFormModal from "./TemplateFormModal";
import type { MessageTemplate, MessageTemplateCategory } from "@/types";

const CATEGORY_LABELS: Record<MessageTemplateCategory, string> = {
  appointment_reminder: "Appointment Reminder",
  appointment_confirmation: "Appointment Confirmation",
  receipt_sent: "Receipt Sent",
  visit_feedback: "Post-Visit Feedback",
  no_show_followup: "No Show Follow-Up",
  visit_follow_up: "Visit Follow-Up",
  custom: "Custom",
};

// The two retention-messaging categories get a highlighted badge instead
// of the neutral one every other category uses — same rust-tinted chip as
// the active session-type pill elsewhere, since these are the two most
// likely to need a staff member's attention (they gate the No Shows and
// Follow-Ups tabs' own send buttons).
const HIGHLIGHTED_CATEGORIES = new Set<MessageTemplateCategory>(["no_show_followup", "visit_follow_up"]);

/** Inline "send this template to a real number" form — lets the owner
 * verify a Meta WhatsApp Cloud API connection actually works (right token,
 * right template name/language/approval) by triggering a real send and
 * checking their own phone, without needing a real patient/receipt to do
 * it through. Shows Meta's raw response body on success as visible
 * confirmation of what was actually sent. */
function TestSendRow({ template, onClose }: { template: MessageTemplate; onClose: () => void }) {
  const [phone, setPhone] = useState("");
  const [values, setValues] = useState<string[]>(() => template.variableLabels.map(() => ""));
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSend() {
    setSending(true);
    setResult(null);
    const res = await sendTestMessageAction(template.id, phone.trim(), values);
    setSending(false);
    if (res.error) {
      setResult({ ok: false, text: res.error });
    } else {
      setResult({ ok: true, text: res.raw ? `Sent. Meta response: ${res.raw}` : "Sent." });
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-beige-300 bg-canvas p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-brown-700">Send a test message</p>
        <button onClick={onClose} className="text-xs text-brown-400 hover:text-brown-700">
          Close
        </button>
      </div>
      <div className="mt-2 space-y-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number to send to, e.g. 9876543210"
          className="w-full rounded-md border border-beige-300 bg-surface px-3 py-1.5 text-sm text-brown-900 outline-none focus:border-rust-600"
        />
        {template.variableLabels.map((label, i) => (
          <input
            key={i}
            value={values[i]}
            onChange={(e) => setValues((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
            placeholder={label || `Variable ${i + 1}`}
            className="w-full rounded-md border border-beige-300 bg-surface px-3 py-1.5 text-sm text-brown-900 outline-none focus:border-rust-600"
          />
        ))}
      </div>
      <button
        onClick={handleSend}
        disabled={sending || !phone.trim()}
        className="mt-2 flex items-center gap-1.5 rounded-md bg-rust-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rust-700 disabled:opacity-50"
      >
        <Send size={12} />
        {sending ? "Sending…" : "Send Test"}
      </button>
      {result && (
        <p className={`mt-2 text-xs ${result.ok ? "text-green-700" : "text-red-700"}`}>{result.text}</p>
      )}
    </div>
  );
}

/** Templates here are just a name + language + variable order the app needs
 * to send — the actual wording and approval both live entirely in Meta's
 * Template Library, outside this app (see types/index.ts MessageTemplate).
 * There's no "submit for approval" step or status to track here at all. */
export default function MessageTemplatesSection({
  initialTemplates,
  isConnected,
  canEdit,
}: {
  initialTemplates: MessageTemplate[];
  isConnected: boolean;
  canEdit: boolean;
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [modalOpen, setModalOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    await deleteTemplateAction(id);
  }

  return (
    <div className="flex flex-col gap-[18px] rounded-[18px] bg-surface p-7 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[19px] font-extrabold text-brown-900">Message Templates</h2>
        {canEdit && (
          <button
            onClick={() => setModalOpen(true)}
            disabled={!isConnected}
            title={isConnected ? undefined : "Connect WhatsApp first"}
            className="flex-shrink-0 rounded-[10px] bg-beige-200 px-4 py-2.5 text-[13px] font-bold text-rust-700 transition-colors hover:bg-beige-300 disabled:opacity-40"
          >
            + New Template
          </button>
        )}
      </div>
      <p className="-mt-2.5 text-[13px] font-medium text-brown-400">
        Templates approved in your Meta Template Library, so the app knows the exact name, language, and variables
        to fill in.
      </p>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-beige-300 py-8 text-center">
          <p className="text-sm font-semibold text-brown-400">No templates yet.</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {templates.map((t, i) => (
            <div key={t.id} className={`py-4 ${i < templates.length - 1 ? "border-b border-beige-100" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 truncate text-[15px] font-bold text-brown-900">{t.name}</span>
                    <span
                      className={`flex-shrink-0 whitespace-nowrap rounded-md px-2 py-[3px] text-[11px] font-bold ${
                        HIGHLIGHTED_CATEGORIES.has(t.category)
                          ? "bg-beige-200 text-rust-700"
                          : "bg-beige-100 text-brown-400"
                      }`}
                    >
                      {CATEGORY_LABELS[t.category]}
                    </span>
                    <span className="flex-shrink-0 whitespace-nowrap rounded-md bg-beige-100 px-2 py-[3px] text-[11px] font-bold uppercase text-brown-400">
                      {t.language}
                    </span>
                  </div>
                  {t.variableLabels.length > 0 && (
                    <p className="mt-1.5 truncate text-[13px] font-medium text-brown-400">
                      Fills: {t.variableLabels.join(", ")}
                    </p>
                  )}
                  {t.bodyPreview && (
                    <p className="mt-1.5 truncate text-[13px] italic text-brown-400">&quot;{t.bodyPreview}&quot;</p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  {canEdit && isConnected && (
                    <button
                      onClick={() => setTestingId(testingId === t.id ? null : t.id)}
                      className="rounded-lg border border-beige-300 px-2.5 py-1.5 text-xs font-bold text-brown-900 transition-colors hover:bg-beige-100/60"
                    >
                      Send Test
                    </button>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="rounded p-1.5 text-brown-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              {testingId === t.id && <TestSendRow template={t} onClose={() => setTestingId(null)} />}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <TemplateFormModal
          onClose={() => setModalOpen(false)}
          onCreated={(template) => {
            setTemplates((prev) => [template, ...prev]);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
