"use client";

import { useState } from "react";
import VisitImportModal from "./VisitImportModal";

export default function VisitImportSection({ canEdit }: { canEdit: boolean }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-brown-900">Import Session History</h2>
          <p className="mt-0.5 text-xs text-brown-400">
            Bring in past visits for existing patients — last visit date, area, fee, and every other field
            for a session type — from a CSV or Excel file, one session type per file.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex-shrink-0 rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
          >
            Import Sessions
          </button>
        )}
      </div>

      {modalOpen && <VisitImportModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
