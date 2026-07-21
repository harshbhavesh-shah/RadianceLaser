import { SESSION_TYPE_CONFIG } from "@/lib/sessionTypes";
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
            const filledEntries = config.columns
              .map((col) => [col, visit.fields?.[col.key]] as const)
              .filter(([, value]) => value !== undefined && value !== "" && value !== null);

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
    </div>
  );
}