"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteTemplateAction } from "@/app/dashboard/settings/messaging/actions";
import TemplateFormModal from "./TemplateFormModal";
import type { MessageTemplate, TemplateApprovalStatus } from "@/types";

const STATUS_STYLES: Record<TemplateApprovalStatus, string> = {
  draft: "bg-beige-300 text-brown-600",
  pending: "bg-gold-100 text-gold-600",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
};

const STATUS_LABELS: Record<TemplateApprovalStatus, string> = {
  draft: "Draft",
  pending: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
};

/** Templates are how WhatsApp's business-initiated messages work at all —
 * Meta requires proactive messages (reminders, confirmations) to use a
 * pre-approved template, so "approval pending" is a real, unavoidable wait
 * state here, not a bug — see lib/whatsapp/gupshupClient.ts submitTemplate(). */
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
            The wording and buttons used for reminders, confirmations, and receipts sent over WhatsApp.
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
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-beige-300 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-brown-900">{t.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[t.approvalStatus]}`}>
                    {STATUS_LABELS[t.approvalStatus]}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-brown-400">{t.body}</p>
                {t.approvalStatus === "rejected" && t.rejectionReason && (
                  <p className="mt-0.5 text-xs text-red-600">{t.rejectionReason}</p>
                )}
              </div>
              {canEdit && (
                <button
                  onClick={() => handleDelete(t.id)}
                  className="flex-shrink-0 rounded p-1.5 text-brown-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <TemplateFormModal
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            setModalOpen(false);
            // Simplest correct refresh given the template now exists
            // server-side with a real approvalStatus — a full reload avoids
            // guessing at the id/fields the server action assigned.
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
