"use client";

import { useState } from "react";
import PackageTypesManager from "@/components/packages/PackageTypesManager";
import AreaDefsManager from "@/components/areas/AreaDefsManager";
import ConsentFormsPanel from "@/components/documents/ConsentFormsPanel";
import ReceiptsPanel from "@/components/documents/ReceiptsPanel";
import type {
  ConsentForm,
  ConsentFormTemplate,
  Package,
  PackageTypeDef,
  Patient,
  Receipt,
  Visit,
} from "@/types";
import type { SessionTypeConfig } from "@/lib/sessionTypes";

type Tab = "packages" | "areas" | "consent" | "receipts";

/** Packages, Treatment Areas, Consent Forms, and Receipts used to be four
 * separate sidebar pages (three of them grouped under "Patient
 * Management" already, plus Documents' own internal two-tab split) —
 * merged into one page with four top-level tabs instead of nesting one
 * tab bar inside another. Each panel keeps exactly the props/behavior it
 * had as a standalone page; only the outer chrome (heading, per-page
 * data fetch) is gone, folded into this page's own tab switch. */
export default function PatientManagementTabs({
  packageTypeDefs,
  sessionTypeConfig,
  canEditPackages,
  canEditAreas,
  clinicId,
  clinicName,
  clinicAddress,
  patients,
  visits,
  packages,
  templates,
  initialForms,
  initialFormsCursor,
  initialReceipts,
  initialReceiptsCursor,
  currentUid,
  currentName,
  canManageTemplates,
  autoOpenReceiptPatientId,
  autoAddReceiptVisitId,
  initialTab,
}: {
  packageTypeDefs: PackageTypeDef[];
  sessionTypeConfig: Record<string, SessionTypeConfig>;
  canEditPackages: boolean;
  canEditAreas: boolean;
  clinicId: string;
  clinicName: string;
  clinicAddress?: string;
  patients: Patient[];
  visits: Visit[];
  packages: Package[];
  templates: ConsentFormTemplate[];
  initialForms: ConsentForm[];
  initialFormsCursor: string | null;
  initialReceipts: Receipt[];
  initialReceiptsCursor: string | null;
  currentUid: string;
  currentName: string;
  canManageTemplates: boolean;
  autoOpenReceiptPatientId?: string;
  autoAddReceiptVisitId?: string;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab || "packages");

  const TABS: { key: Tab; label: string }[] = [
    { key: "packages", label: "Packages" },
    { key: "areas", label: "Areas" },
    { key: "consent", label: "Consent Forms" },
    { key: "receipts", label: "Receipts" },
  ];

  return (
    <div>
      <div className="mb-6 flex max-w-xl gap-1 rounded-lg border border-beige-300 bg-surface p-1 shadow-soft">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-rust-100 text-rust-700" : "text-brown-600 hover:text-brown-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "packages" && (
        <PackageTypesManager
          initialPackageTypeDefs={packageTypeDefs}
          sessionTypeConfig={sessionTypeConfig}
          canEdit={canEditPackages}
        />
      )}

      {tab === "areas" && <AreaDefsManager canEdit={canEditAreas} />}

      {tab === "consent" && (
        <ConsentFormsPanel
          clinicId={clinicId}
          clinicName={clinicName}
          patients={patients}
          visits={visits}
          templates={templates}
          initialForms={initialForms}
          initialCursor={initialFormsCursor}
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
          initialCursor={initialReceiptsCursor}
          currentUid={currentUid}
          currentName={currentName}
          autoOpenPatientId={autoOpenReceiptPatientId}
          autoAddVisitId={autoAddReceiptVisitId}
        />
      )}
    </div>
  );
}
