"use client";

import { useMemo, useState } from "react";
import { FileSignature, Search } from "lucide-react";
import ConsentTemplatesSection from "@/components/settings/ConsentTemplatesSection";
import ConsentFormSignModal from "@/components/ConsentFormSignModal";
import ConsentFormViewModal from "@/components/ConsentFormViewModal";
import PatientPicker from "./PatientPicker";
import type { ConsentForm, ConsentFormTemplate, Patient, Visit } from "@/types";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default function ConsentFormsPanel({
  clinicId,
  clinicName,
  patients,
  visits,
  templates,
  initialForms,
  currentUid,
  currentName,
  canManageTemplates,
}: {
  clinicId: string;
  clinicName: string;
  patients: Patient[];
  visits: Visit[];
  templates: ConsentFormTemplate[];
  initialForms: ConsentForm[];
  currentUid: string;
  currentName: string;
  canManageTemplates: boolean;
}) {
  const [forms, setForms] = useState<ConsentForm[]>(initialForms);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [signingPatient, setSigningPatient] = useState<Patient | null>(null);
  const [viewingForm, setViewingForm] = useState<ConsentForm | null>(null);
  const [search, setSearch] = useState("");

  const patientById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);

  const filteredForms = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...forms].sort((a, b) => b.signedAt - a.signedAt);
    if (!q) return sorted;
    return sorted.filter((f) => {
      const name = patientById.get(f.patientId)?.name || "";
      return name.toLowerCase().includes(q) || f.templateTitle.toLowerCase().includes(q);
    });
  }, [forms, search, patientById]);

  function handleSigned(form: ConsentForm) {
    setForms((prev) => [form, ...prev]);
    setSigningPatient(null);
  }

  function handleDeleted(id: string) {
    setForms((prev) => prev.filter((f) => f.id !== id));
    setViewingForm(null);
  }

  return (
    <div className="space-y-6">
      <ConsentTemplatesSection clinicId={clinicId} initialTemplates={templates} canEdit={canManageTemplates} />

      <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-medium text-brown-900">Signed Consent Forms</h2>
            <p className="mt-0.5 text-xs text-brown-400">Every consent form signed across the clinic.</p>
          </div>
          <button
            onClick={() => setPickerOpen(true)}
            className="flex-shrink-0 rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
          >
            + New Consent Form
          </button>
        </div>

        {forms.length > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-beige-300 bg-canvas px-3 py-2">
            <Search size={16} className="text-brown-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by patient or form title…"
              className="w-full bg-transparent text-sm text-brown-900 outline-none placeholder:text-brown-400"
            />
          </div>
        )}

        {filteredForms.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-beige-300 py-8 text-center">
            <FileSignature className="text-brown-400" size={26} />
            <p className="mt-2 text-sm text-brown-400">
              {forms.length === 0 ? "No signed consent forms yet." : "No forms match that search."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredForms.map((form, i) => (
              <button
                key={form.id}
                onClick={() => setViewingForm(form)}
                style={{ animationDelay: `${i * 30}ms` }}
                className="animate-fade-up flex w-full items-center justify-between gap-3 rounded-lg border border-beige-300 px-4 py-3 text-left transition-colors hover:bg-gold-100/40"
              >
                <div>
                  <div className="text-sm font-medium text-brown-900">
                    {patientById.get(form.patientId)?.name || "Unknown patient"}
                  </div>
                  <div className="text-xs text-brown-400">
                    {form.templateTitle} · Signed by {form.signedByName}
                  </div>
                </div>
                <span className="text-xs text-brown-400">{formatDate(form.signedAt)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {pickerOpen && (
        <PatientPicker
          patients={patients}
          title="Choose a patient"
          onClose={() => setPickerOpen(false)}
          onSelect={(p) => {
            setPickerOpen(false);
            setSigningPatient(p);
          }}
        />
      )}

      {signingPatient && (
        <ConsentFormSignModal
          clinicId={clinicId}
          patientId={signingPatient.id}
          patientName={signingPatient.name}
          clinicName={clinicName}
          templates={templates}
          visits={visits.filter((v) => v.patientId === signingPatient.id)}
          currentUid={currentUid}
          currentName={currentName}
          onClose={() => setSigningPatient(null)}
          onSigned={handleSigned}
        />
      )}

      {viewingForm && (
        <ConsentFormViewModal form={viewingForm} onClose={() => setViewingForm(null)} onDeleted={handleDeleted} />
      )}
    </div>
  );
}
