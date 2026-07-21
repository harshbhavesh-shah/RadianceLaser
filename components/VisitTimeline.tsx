"use client";

import { useState } from "react";
import { SESSION_TYPE_CONFIG } from "@/lib/sessionTypes";
import VisitFormModal from "@/components/VisitFormModal";
import type { SessionType, Visit } from "@/types";

function formatDate(dateStr: string): string {
  if (!dateStr) return "No date set";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function formatFieldValue(key: string, value: string | number): string {
  if (key === "fee") return `₹${Number(value).toLocaleString("en-IN")}`;
  return String(value);
}

export default function VisitTimeline({
  clinicId,
  patientId,
  sessionType,
  initialVisits,
}: {
  clinicId: string;
  patientId: string;
  sessionType: SessionType;
  initialVisits: Visit[];
}) {
  const config = SESSION_TYPE_CONFIG[sessionType];
  const [visits, setVisits] = useState<Visit[]>(
    [...initialVisits].sort((a, b) => (b.date || "").localeCompare(a.date || ""))
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);

  function openCreateModal() {
    setEditingVisit(null);
    setModalOpen(true);
  }

  function openEditModal(visit: Visit) {
    setEditingVisit(visit);
    setModalOpen(true);
  }

  function handleSaved(saved: Visit) {
    setVisits((prev) => {
      const exists = prev.some((v) => v.id === saved.id);
      const next = exists ? prev.map((v) => (v.id === saved.id ? saved : v)) : [saved, ...prev];
      return next.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    });
    setModalOpen(false);
  }

  function handleDeleted(visitId: string) {
    setVisits((prev) => prev.filter((v) => v.id !== visitId));
    setModalOpen(false);
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={openCreateModal}
          className="rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
        >
          + Log New Visit
        </button>
      </div>

      {visits.length === 0 ? (
        <div className="rounded-xl bg-surface p-10 text-center shadow-soft ring-1 ring-beige-300">
          <p className="text-sm text-brown-600">No {config.label} visits logged yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visits.map((visit) => {
            const filledEntries = config.columns
              .map((col) => [col, visit.fields?.[col.key]] as const)
              .filter(([, value]) => value !== undefined && value !== "" && value !== null);

            return (
              <button
                key={visit.id}
                onClick={() => openEditModal(visit)}
                className="group block w-full rounded-xl bg-surface p-4 text-left shadow-soft ring-1 ring-beige-300 transition-shadow hover:shadow-card"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-base font-medium text-brown-900">
                    {formatDate(visit.date)}
                  </span>
                  <span className="text-xs font-medium text-brown-400 opacity-0 transition-opacity group-hover:opacity-100">
                    Edit →
                  </span>
                </div>

                {filledEntries.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-brown-600">
                    {filledEntries.map(([col, value]) => (
                      <span key={col.key}>
                        <span className="text-brown-400">{col.label}:</span>{" "}
                        <span className="text-brown-900">{formatFieldValue(col.key, value!)}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm italic text-brown-400">No details recorded</p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <VisitFormModal
          clinicId={clinicId}
          patientId={patientId}
          sessionType={sessionType}
          visit={editingVisit}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
