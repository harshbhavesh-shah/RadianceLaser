"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { Patient } from "@/types";

/** Patients list with a live search bar — filters by name, phone, or patient
 * ID as you type, entirely client-side over the clinic's already-loaded
 * patient list (same scale assumption as the rest of the app: cheap for one
 * clinic's roster). This is the "find a patient" entry point for the app —
 * previously a separate sidebar search modal, moved here to sit with the
 * list it searches. */
export default function PatientsTable({ patients }: { patients: Patient[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        p.patientCode.toLowerCase().includes(q)
    );
  }, [patients, query]);

  return (
    <div>
      <div className="mb-5 flex items-center gap-2 rounded-md border border-beige-300 bg-surface px-3 py-2.5 shadow-soft">
        <Search size={18} className="flex-shrink-0 text-brown-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, or patient ID…"
          className="w-full bg-transparent text-sm text-brown-900 outline-none placeholder:text-brown-400"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl bg-surface p-10 text-center shadow-soft ring-1 ring-beige-300">
          <p className="text-sm text-brown-600">
            {patients.length === 0 ? "No patients yet." : "No patients match that search."}
          </p>
          {patients.length === 0 && (
            <Link
              href="/dashboard/patients/new"
              className="mt-3 inline-block text-sm font-medium text-gold-600 hover:underline"
            >
              Add your first patient
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-surface shadow-soft ring-1 ring-beige-300">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr className="border-b border-beige-300 bg-beige-200/50 text-xs uppercase tracking-wide text-brown-600">
                <th className="px-5 py-3 font-medium">Patient</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Skin Type</th>
                <th className="px-5 py-3 font-medium">Patient ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((patient) => (
                <tr key={patient.id} className="border-b border-beige-300 last:border-0 hover:bg-gold-100/40">
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/patients/${patient.id}`}
                      className="font-medium text-brown-900 hover:text-gold-600"
                    >
                      {patient.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-brown-600">{patient.phone}</td>
                  <td className="px-5 py-3 text-brown-600">
                    {patient.skinType ? `Type ${patient.skinType}` : "—"}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-brown-600">{patient.patientCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
