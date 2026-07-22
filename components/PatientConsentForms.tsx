"use client";

import { useState } from "react";
import { FileSignature } from "lucide-react";
import ConsentFormSignModal from "./ConsentFormSignModal";
import ConsentFormViewModal from "./ConsentFormViewModal";
import type { ConsentForm, ConsentFormTemplate, Visit } from "@/types";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default function PatientConsentForms({
  clinicId,
  patientId,
  patientName,
  clinicName,
  templates,
  visits,
  initialForms,
  currentUid,
  currentName,
}: {
  clinicId: string;
  patientId: string;
  patientName: string;
  clinicName: string;
  templates: ConsentFormTemplate[];
  visits: Visit[];
  initialForms: ConsentForm[];
  currentUid: string;
  currentName: string;
}) {
  const [forms, setForms] = useState<ConsentForm[]>(initialForms);
  const [signOpen, setSignOpen] = useState(false);
  const [viewingForm, setViewingForm] = useState<ConsentForm | null>(null);

  function handleSigned(form: ConsentForm) {
    setForms((prev) => [form, ...prev]);
    setSignOpen(false);
  }

  function handleDeleted(id: string) {
    setForms((prev) => prev.filter((f) => f.id !== id));
    setViewingForm(null);
  }

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-brown-900">Consent Forms</h2>
          <p className="mt-0.5 text-xs text-brown-400">Signed with an e-signature, kept on file.</p>
        </div>
        <button
          onClick={() => setSignOpen(true)}
          className="flex-shrink-0 rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
        >
          + New Consent Form
        </button>
      </div>

      {forms.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-beige-300 py-8 text-center">
          <FileSignature className="text-brown-400" size={26} />
          <p className="mt-2 text-sm text-brown-400">No signed consent forms yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {forms.map((form, i) => (
            <button
              key={form.id}
              onClick={() => setViewingForm(form)}
              style={{ animationDelay: `${i * 40}ms` }}
              className="animate-fade-up flex w-full items-center justify-between gap-3 rounded-lg border border-beige-300 px-4 py-3 text-left transition-colors hover:bg-gold-100/40"
            >
              <div>
                <div className="text-sm font-medium text-brown-900">{form.templateTitle}</div>
                <div className="text-xs text-brown-400">Signed by {form.signedByName}</div>
              </div>
              <span className="text-xs text-brown-400">{formatDate(form.signedAt)}</span>
            </button>
          ))}
        </div>
      )}

      {signOpen && (
        <ConsentFormSignModal
          clinicId={clinicId}
          patientId={patientId}
          patientName={patientName}
          clinicName={clinicName}
          templates={templates}
          visits={visits}
          currentUid={currentUid}
          currentName={currentName}
          onClose={() => setSignOpen(false)}
          onSigned={handleSigned}
        />
      )}

      {viewingForm && (
        <ConsentFormViewModal form={viewingForm} onClose={() => setViewingForm(null)} onDeleted={handleDeleted} />
      )}
    </div>
  );
}
