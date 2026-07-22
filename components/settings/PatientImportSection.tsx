"use client";

import { useState } from "react";
import PatientImportModal from "./PatientImportModal";

export default function PatientImportSection({ canEdit }: { canEdit: boolean }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-brown-900">Import Patients</h2>
          <p className="mt-0.5 text-xs text-brown-400">
            Bring in your existing patient list from a CSV or Excel file — map the columns, preview,
            and import in one go.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex-shrink-0 rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
          >
            Import Patients
          </button>
        )}
      </div>

      {modalOpen && <PatientImportModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
