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
  custom: "Custom",
};

/** Inline "send this template to a real number" form — lets the owner
 * verify a BhashSMS connection actually works (right password, right
 * template name/approval) by triggering a real send and checking their own
 * phone, without needing a real patient/receipt to do it through. Shows
 * BhashSMS's raw response text on success since that response format is
 * otherwise unverified. */
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
      setResult({ ok: true, text: res.raw ? `Sent. BhashSMS response: ${res.raw}` : "Sent." });
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
          className="w-full rounded-md border border-beige-300 bg-surface px-3 py-1.5 text-sm text-brown-900 outline-none focus:border-gold-500"
        />
        {template.variableLabels.map((label, i) => (
          <input
            key={i}
            value={values[i]}
            onChange={(e) => setValues((prev) => prev.map((v, idx) => (idx === i ? e.target.value : v)))}
            placeholder={label || `Variable ${i + 1}`}
            className="w-full rounded-md border border-beige-300 bg-surface px-3 py-1.5 text-sm text-brown-900 outline-none focus:border-gold-500"
          />
        ))}
      </div>
      <button
        onClick={handleSend}
        disabled={sending || !phone.trim()}
        className="mt-2 flex items-center gap-1.5 rounded-md bg-brown-900 px-3 py-1.5 text-xs font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-50"
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

/** Templates here are just a name + variable order the app needs to send —
 * the actual wording and Meta approval both live entirely on BhashSMS's own
 * dashboard, outside this app (see types/index.ts MessageTemplate). Unlike
 * the old Gupshup flow, there's no "submit for approval" step or status to
 * track here at all. */
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
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-brown-900">Message Templates</h2>
          <p className="mt-0.5 text-xs text-brown-400">
            Templates approved on your BhashSMS/Meta account — this just tells the app the exact name and what
            variables to fill in.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setModalOpen(true)}
            disabled={!isConnected}
            title={isConnected ? undefined : "Connect WhatsApp first"}
            className="flex-shrink-0 rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-40"
          >
            + New Template
          </button>
        )}
      </div>

      {templates.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-lg border border-dashed border-beige-300 py-8 text-center">
          <p className="text-sm text-brown-400">No templates yet.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="rounded-lg border border-beige-300 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-brown-900">{t.name}</span>
                    <span className="rounded-full bg-beige-200 px-2 py-0.5 text-[10px] font-semibold text-brown-600">
                      {CATEGORY_LABELS[t.category]}
                    </span>
                  </div>
                  {t.variableLabels.length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-brown-400">Fills: {t.variableLabels.join(", ")}</p>
                  )}
                  {t.bodyPreview && (
                    <p className="mt-0.5 truncate text-xs text-brown-400 italic">"{t.bodyPreview}"</p>
                  )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  {canEdit && isConnected && (
                    <button
                      onClick={() => setTestingId(testingId === t.id ? null : t.id)}
                      className="rounded-md border border-beige-300 px-2.5 py-1 text-xs font-medium text-brown-700 transition-colors hover:border-gold-500"
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
