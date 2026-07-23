"use client";

import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
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
  sessionType,
  visits,
  onAddNew,
  onEdit,
}: {
  sessionType: SessionType;
  visits: Visit[];
  onAddNew: () => void;
  onEdit: (visit: Visit) => void;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const config = SESSION_TYPE_CONFIG[sessionType];
  const sorted = [...visits].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={onAddNew}
          className="rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
        >
          + Log New Visit
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl bg-surface p-10 text-center shadow-soft ring-1 ring-beige-300">
          <p className="text-sm text-brown-600">No {config.label} visits logged yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((visit) => {
            // Multiple treated areas in one visit each get their own row of
            // details below the date; a single area (or an older visit
            // logged before multi-area existed, which only has `fields`)
            // falls back to one flat row, same as before this feature.
            const multiArea = (visit.areas?.length || 0) > 1;
            const areaRows = multiArea
              ? visit.areas!.map((entry) =>
                  config.columns
                    .map((col) => [col, entry.fields[col.key]] as const)
                    .filter(([, value]) => value !== undefined && value !== "" && value !== null)
                )
              : [
                  config.columns
                    .map((col) => [col, visit.fields?.[col.key]] as const)
                    .filter(([, value]) => value !== undefined && value !== "" && value !== null),
                ];

            return (
              <button
                key={visit.id}
                onClick={() => onEdit(visit)}
                className="group block w-full rounded-xl bg-surface p-4 text-left shadow-soft ring-1 ring-beige-300 transition-shadow hover:shadow-card"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="font-display text-base font-medium text-brown-900">
                      {formatDate(visit.date)}
                    </span>
                    {visit.packageId && (
                      <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gold-600">
                        Package
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-medium text-brown-400 opacity-0 transition-opacity group-hover:opacity-100">
                    Edit →
                  </span>
                </div>

                {areaRows.every((row) => row.length === 0) ? (
                  <p className="mt-2 text-sm italic text-brown-400">No details recorded</p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {areaRows.map((row, i) => (
                      <div key={i} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-brown-600">
                        {multiArea && (
                          <span className="rounded-full bg-beige-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brown-600">
                            Area {i + 1}
                          </span>
                        )}
                        {row.length > 0 ? (
                          row.map(([col, value]) => (
                            <span key={col.key}>
                              <span className="text-brown-400">{col.label}:</span>{" "}
                              <span className="text-brown-900">{formatFieldValue(col.key, value!)}</span>
                            </span>
                          ))
                        ) : (
                          <span className="italic text-brown-400">No details recorded</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}