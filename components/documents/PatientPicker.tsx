"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { Patient } from "@/types";

/** Searchable patient combobox — used wherever the Documents section needs
 * "pick a patient" before generating a clinic-wide document type (consent
 * form or receipt), since those flows don't start from a specific patient's
 * page. Filters client-side over the clinic's already-loaded patient list. */
export default function PatientPicker({
  patients,
  onSelect,
  onClose,
  title,
}: {
  patients: Patient[];
  onSelect: (patient: Patient) => void;
  onClose: () => void;
  title: string;
}) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...patients].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted.slice(0, 30);
    return sorted
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          p.patientCode.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [patients, query]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
      <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-xl bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-beige-300 px-5 py-4">
          <h2 className="font-display text-lg font-medium text-brown-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-brown-600 hover:bg-beige-200" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-beige-300 px-5 py-3">
          <div className="flex items-center gap-2 rounded-md border border-beige-300 bg-canvas px-3 py-2">
            <Search size={16} className="text-brown-400" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, phone, or patient ID…"
              className="w-full bg-transparent text-sm text-brown-900 outline-none placeholder:text-brown-400"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-brown-400">No patients match that search.</p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="flex w-full items-center justify-between gap-3 border-b border-beige-300 px-5 py-3 text-left last:border-0 hover:bg-gold-100/40"
              >
                <div>
                  <div className="text-sm font-medium text-brown-900">{p.name}</div>
                  <div className="text-xs text-brown-400">{p.phone}</div>
                </div>
                <span className="rounded-full bg-beige-200 px-2.5 py-0.5 font-mono text-[11px] text-brown-600">
                  {p.patientCode}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
