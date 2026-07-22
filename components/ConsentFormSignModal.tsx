"use client";

import { useMemo, useRef, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { renderConsentTemplate } from "@/lib/consentForms";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import SignaturePad, { type SignaturePadHandle } from "./SignaturePad";
import type { ConsentForm, ConsentFormTemplate, Visit } from "@/types";

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
}

export default function ConsentFormSignModal({
  clinicId,
  patientId,
  patientName,
  clinicName,
  templates,
  visits,
  currentUid,
  currentName,
  onClose,
  onSigned,
}: {
  clinicId: string;
  patientId: string;
  patientName: string;
  clinicName: string;
  templates: ConsentFormTemplate[];
  visits: Visit[];
  currentUid: string;
  currentName: string;
  onClose: () => void;
  onSigned: (form: ConsentForm) => void;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const signatureRef = useRef<SignaturePadHandle>(null);

  const sortedVisits = useMemo(
    () => [...visits].sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.createdAt - a.createdAt),
    [visits]
  );

  const [templateId, setTemplateId] = useState(templates[0]?.id || "");
  const [visitId, setVisitId] = useState("");
  const [signedByName, setSignedByName] = useState(patientName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = templates.find((t) => t.id === templateId);
  const selectedVisit = sortedVisits.find((v) => v.id === visitId);
  const area = typeof selectedVisit?.fields?.area === "string" ? selectedVisit.fields.area : undefined;
  const treatmentType = selectedVisit
    ? SESSION_TYPE_CONFIG[selectedVisit.sessionType]?.label || selectedVisit.sessionType
    : undefined;

  const renderedBody = template
    ? renderConsentTemplate(template.body, { patientName, clinicName, date: todayLabel(), treatmentType, area })
    : "";

  async function handleSave() {
    if (!template) return setError("Choose a consent form.");
    if (!signedByName.trim()) return setError("Enter the name of the person signing.");
    if (signatureRef.current?.isEmpty()) return setError("A signature is required.");

    setSaving(true);
    setError(null);

    try {
      const signatureDataUrl = signatureRef.current?.getDataUrl();
      if (!signatureDataUrl) throw new Error("Couldn't capture signature.");

      const id = crypto.randomUUID();
      const payload = {
        clinicId,
        patientId,
        templateId: template.id,
        templateTitle: template.title,
        ...(visitId ? { visitId } : {}),
        renderedBody,
        signatureDataUrl,
        signedByName: signedByName.trim(),
        witnessUid: currentUid,
        witnessName: currentName,
        signedAt: Date.now(),
        createdAt: Date.now(),
      };
      await setDoc(doc(db, "consentForms", id), payload);
      onSigned({ id, ...payload });
    } catch (err) {
      console.error("Failed to save consent form:", err);
      const code = (err as { code?: string })?.code;
      setError(
        code === "permission-denied"
          ? "You don't have permission to save this. Check that Firestore rules are deployed and try signing in again."
          : "Couldn't save this consent form. Please try again."
      );
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  if (templates.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
        <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-card">
          <h2 className="font-display text-lg font-medium text-brown-900">No Consent Templates Yet</h2>
          <p className="mt-2 text-sm text-brown-600">
            Ask an owner to add a consent form template in Settings before signing one here.
          </p>
          <div className="mt-5 flex justify-end">
            <button
              onClick={onClose}
              className="rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 hover:bg-gold-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-surface p-6 shadow-card">
        <h2 className="font-display text-lg font-medium text-brown-900">New Consent Form</h2>
        <div className="mb-5 mt-3 h-[2px] w-8 bg-gold-500" />

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">Consent Form</label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">
                Link to Session <span className="text-brown-400">(optional)</span>
              </label>
              <select
                value={visitId}
                onChange={(e) => setVisitId(e.target.value)}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              >
                <option value="">No specific session</option>
                {sortedVisits.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.date || "Undated"} · {SESSION_TYPE_CONFIG[v.sessionType]?.label || v.sessionType}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">Preview</label>
            <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md border border-beige-300 bg-canvas px-3 py-2.5 text-sm text-brown-800">
              {renderedBody}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">Signed By</label>
            <input
              type="text"
              value={signedByName}
              onChange={(e) => setSignedByName(e.target.value)}
              placeholder="Patient name, or a parent/guardian signing on their behalf"
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">Signature</label>
            <SignaturePad ref={signatureRef} />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm font-medium text-brown-600 hover:bg-beige-200 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Signed Form"}
          </button>
        </div>
      </div>
    </div>
  );
}
