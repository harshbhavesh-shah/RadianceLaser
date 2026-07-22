"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import type { Patient } from "@/types";

/** Clinic-wide patient search, reachable from anywhere in the dashboard via
 * the sidebar's "Search Patients" button. Filters the already-loaded patient
 * list (see app/dashboard/layout.tsx) by name, phone number, or patient ID —
 * no per-keystroke network round-trip needed at the scale of one clinic. */
export default function PatientSearchModal({
  patients,
  onClose,
}: {
  patients: Patient[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...patients].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted.slice(0, 20);
    return sorted
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.phone.toLowerCase().includes(q) ||
          p.patientCode.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [patients, query]);

  function goToPatient(p: Patient) {
    onClose();
    router.push(`/dashboard/patients/${p.id}`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-brown-900/40 px-4 pt-24"
      onClick={onClose}
    >
      <div
        className="max-h-[70vh] w-full max-w-lg overflow-hidden rounded-xl bg-surface shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-beige-300 px-4 py-3.5">
          <Search size={18} className="flex-shrink-0 text-brown-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patients by name, phone, or patient ID…"
            className="w-full bg-transparent text-sm text-brown-900 outline-none placeholder:text-brown-400"
          />
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-md p-1 text-brown-400 hover:bg-beige-200 hover:text-brown-700"
            aria-label="Close search"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[54vh] overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-brown-400">No patients match that search.</p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                onClick={() => goToPatient(p)}
                className="flex w-full items-center justify-between gap-3 border-b border-beige-300 px-4 py-3 text-left last:border-0 hover:bg-gold-100/40"
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
