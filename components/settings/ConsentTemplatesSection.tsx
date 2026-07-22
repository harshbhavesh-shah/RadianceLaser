"use client";

import { useState } from "react";
import ConsentTemplateFormModal from "./ConsentTemplateFormModal";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import type { ConsentFormTemplate } from "@/types";

export default function ConsentTemplatesSection({
  clinicId,
  initialTemplates,
  canEdit,
}: {
  clinicId: string;
  initialTemplates: ConsentFormTemplate[];
  canEdit: boolean;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const [templates, setTemplates] = useState<ConsentFormTemplate[]>(initialTemplates);
  const [editingTemplate, setEditingTemplate] = useState<ConsentFormTemplate | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function openCreate() {
    setEditingTemplate(null);
    setModalOpen(true);
  }

  function openEdit(template: ConsentFormTemplate) {
    setEditingTemplate(template);
    setModalOpen(true);
  }

  function handleSaved(saved: ConsentFormTemplate) {
    setTemplates((prev) => {
      const exists = prev.some((t) => t.id === saved.id);
      return exists ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved];
    });
    setModalOpen(false);
  }

  function handleDeleted(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setModalOpen(false);
  }

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-medium text-brown-900">Consent Forms</h2>
          <p className="mt-0.5 text-xs text-brown-400">
            Templates staff can have patients sign — with e-signature — right from the patient
            page.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex-shrink-0 rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
          >
            + New Template
          </button>
        )}
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-brown-400">No consent form templates yet.</p>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => canEdit && openEdit(template)}
              disabled={!canEdit}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-beige-300 px-4 py-3 text-left transition-colors enabled:hover:bg-gold-100/40 disabled:cursor-default"
            >
              <span className="text-sm font-medium text-brown-900">{template.title}</span>
              <span className="text-xs text-brown-400">
                {template.sessionType
                  ? SESSION_TYPE_CONFIG[template.sessionType]?.label || template.sessionType
                  : "General"}
              </span>
            </button>
          ))}
        </div>
      )}

      {modalOpen && (
        <ConsentTemplateFormModal
          clinicId={clinicId}
          editing={editingTemplate}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
