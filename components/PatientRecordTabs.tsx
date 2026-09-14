"use client";

import { useState } from "react";
import PatientVisitTabs from "./PatientVisitTabs";
import PatientPhotoGallery from "./PatientPhotoGallery";
import PatientConsentForms from "./PatientConsentForms";
import PatientReceipts from "./PatientReceipts";

type TabKey = "history" | "photos" | "consent" | "receipts";

const TABS: { key: TabKey; label: string }[] = [
  { key: "history", label: "Treatment History" },
  { key: "photos", label: "Photos" },
  { key: "consent", label: "Consent Forms" },
  { key: "receipts", label: "Receipts" },
];

/** The Patient Record's four top-level sections, as real tabs instead of
 * one long stacked page — Treatment History / Photos / Consent Forms /
 * Receipts. Prop shapes are lifted straight from each section's own
 * component (React.ComponentProps) rather than redeclared here, so this
 * can never drift out of sync with what each one actually needs. Always
 * opens on Treatment History, including when arriving via a "Log Visit"
 * deep link — that link's sessionType/appointmentId targeting is handled
 * one level down, inside PatientVisitTabs' own session-type sub-tabs. */
export default function PatientRecordTabs({
  visitTabs,
  photoGallery,
  consentForms,
  receipts,
}: {
  visitTabs: React.ComponentProps<typeof PatientVisitTabs>;
  photoGallery: React.ComponentProps<typeof PatientPhotoGallery>;
  consentForms: React.ComponentProps<typeof PatientConsentForms>;
  receipts: React.ComponentProps<typeof PatientReceipts>;
}) {
  const [active, setActive] = useState<TabKey>("history");

  return (
    <div>
      <div className="mb-6 flex gap-6 border-b border-beige-300">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors ${
              active === tab.key
                ? "border-rust-600 text-brown-900"
                : "border-transparent text-brown-500 hover:text-brown-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "history" && <PatientVisitTabs {...visitTabs} />}
      {active === "photos" && <PatientPhotoGallery {...photoGallery} />}
      {active === "consent" && <PatientConsentForms {...consentForms} />}
      {active === "receipts" && <PatientReceipts {...receipts} />}
    </div>
  );
}
