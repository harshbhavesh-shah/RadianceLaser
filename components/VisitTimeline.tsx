"use client";

import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import type { SessionColumnDef, SessionType, Visit } from "@/types";

function formatDate(dateStr: string): string {
  if (!dateStr) return "No date set";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function formatCellValue(key: string, value: string | number | undefined): string {
  if (value === undefined || value === "" || value === null) return "";
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
  // Whether this session type distinguishes treated areas at all — if so,
  // consecutive rows sharing the same Area value are further passes of the
  // SAME area (a thin divider between them), not a new one (a thick
  // divider) — see isNewAreaGroup below.
  const hasAreaColumn = config.columns.some((c) => c.key === "area");

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
            // Each area entry is a real row (usually one pass) — a visit
            // logged before multi-area entry existed only has `fields`,
            // which is equivalent to a single row.
            const rows =
              visit.areas && visit.areas.length > 0
                ? visit.areas.map((entry) => entry.fields)
                : visit.fields
                  ? [visit.fields]
                  : [];
            const hasAnyDetails = rows.some((row) =>
              config.columns.some((col) => row[col.key] !== undefined && row[col.key] !== "" && row[col.key] !== null)
            );

            // A row with no Area filled in isn't a new area of its own —
            // it's read as "still working on whichever area was named
            // last," so it inherits the thin divider rather than earning a
            // thick one. Tracking the last *named* area (not just the
            // previous row) is what makes that work even after more than
            // one blank row in a row.
            let lastNamedArea: string | number | undefined;
            const isNewAreaGroup = rows.map((row, i) => {
              const area = row["area"];
              const isNew = i > 0 && hasAreaColumn && !!area && area !== lastNamedArea;
              if (area) lastNamedArea = area;
              return isNew;
            });

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

                {!hasAnyDetails ? (
                  <p className="mt-2 text-sm italic text-brown-400">No details recorded</p>
                ) : (
                  <div className="mt-3 overflow-x-auto rounded-lg border border-beige-300">
                    <table className="w-full min-w-[420px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-beige-300 bg-beige-100">
                          {config.columns.map((col: SessionColumnDef) => (
                            <th
                              key={col.key}
                              className="whitespace-nowrap border-r border-beige-200 px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-brown-600 last:border-r-0"
                            >
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => {
                          const topBorder =
                            i === 0
                              ? ""
                              : isNewAreaGroup[i]
                                ? "border-t-2 border-gold-500"
                                : "border-t border-beige-200";
                          return (
                            <tr key={i} className={topBorder}>
                              {config.columns.map((col) => (
                                <td
                                  key={col.key}
                                  className="whitespace-nowrap border-r border-beige-200 px-2.5 py-1.5 text-brown-900 last:border-r-0"
                                >
                                  {formatCellValue(col.key, row[col.key])}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
