"use client";

import { useState } from "react";
import ConsentFormsPanel from "./ConsentFormsPanel";
import ReceiptsPanel from "./ReceiptsPanel";
import type { ConsentForm, ConsentFormTemplate, Package, Patient, Receipt, Visit } from "@/types";

type Tab = "consent" | "receipts";

export default function DocumentsTabs({
  clinicId,
  clinicName,
  clinicAddress,
  patients,
  visits,
  packages,
  templates,
  initialForms,
  initialReceipts,
  currentUid,
  currentName,
  canManageTemplates,
  initialTab,
  autoOpenReceiptPatientId,
  autoAddReceiptVisitId,
}: {
  clinicId: string;
  clinicName: string;
  clinicAddress?: string;
  patients: Patient[];
  visits: Visit[];
  packages: Package[];
  templates: ConsentFormTemplate[];
  initialForms: ConsentForm[];
  initialReceipts: Receipt[];
  currentUid: string;
  currentName: string;
  canManageTemplates: boolean;
  // Set by the "Generate Receipt" pipeline shortcut on an appointment (see
  // lib/pipeline.ts) — lands on the Receipts tab with that patient/visit
  // already loaded instead of the default Consent Forms tab.
  initialTab?: Tab;
  autoOpenReceiptPatientId?: string;
  autoAddReceiptVisitId?: string;
}) {
  const [tab, setTab] = useState<Tab>(initialTab || "consent");

  const TABS: { key: Tab; label: string }[] = [
    { key: "consent", label: "Consent Forms" },
    { key: "receipts", label: "Receipts" },
  ];

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-lg bg-beige-200/60 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-surface text-brown-900 shadow-soft" : "text-brown-600 hover:text-brown-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "consent" && (
        <ConsentFormsPanel
          clinicId={clinicId}
          clinicName={clinicName}
          patients={patients}
          visits={visits}
          templates={templates}
          initialForms={initialForms}
          currentUid={currentUid}
          currentName={currentName}
          canManageTemplates={canManageTemplates}
        />
      )}

      {tab === "receipts" && (
        <ReceiptsPanel
          clinicId={clinicId}
          clinicName={clinicName}
          clinicAddress={clinicAddress}
          patients={patients}
          visits={visits}
          packages={packages}
          initialReceipts={initialReceipts}
          currentUid={currentUid}
          currentName={currentName}
          autoOpenPatientId={autoOpenReceiptPatientId}
          autoAddVisitId={autoAddReceiptVisitId}
        />
      )}
    </div>
  );
}
