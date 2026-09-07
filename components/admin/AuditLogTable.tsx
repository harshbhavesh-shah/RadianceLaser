import type { AdminAuditAction, AdminAuditLogEntry } from "@/types";

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const ACTION_LABELS: Record<AdminAuditAction, string> = {
  extend: "Extended",
  activate: "Activated",
  terminate: "Terminated",
  delete: "Deleted",
  price_change: "Price changed",
  impersonate: "Viewed as",
};

const ACTION_STYLES: Record<AdminAuditAction, string> = {
  extend: "bg-beige-200 text-brown-800",
  activate: "bg-green-100 text-green-800",
  terminate: "bg-orange-100 text-orange-800",
  delete: "bg-red-100 text-red-800",
  price_change: "bg-gold-100 text-brown-800",
  impersonate: "bg-blue-100 text-blue-800",
};

function ActionBadge({ action }: { action: AdminAuditAction }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ACTION_STYLES[action]}`}>
      {ACTION_LABELS[action]}
    </span>
  );
}

export default function AuditLogTable({ entries }: { entries: AdminAuditLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-brown-400">No manual overrides have been logged yet.</p>;
  }

  return (
    <>
      {/* Mobile: stacked cards, same pattern as ClinicsTable. */}
      <div className="space-y-3 md:hidden">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-xl bg-surface p-4 shadow-soft ring-1 ring-beige-300">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium text-brown-900">{entry.clinicName ?? "Platform-wide"}</div>
                <div className="text-xs text-brown-400">{formatDateTime(entry.createdAt)}</div>
              </div>
              <ActionBadge action={entry.action} />
            </div>
            <div className="mt-2 text-sm text-brown-700">{entry.detail}</div>
            <div className="mt-2 text-xs text-brown-400">{entry.performedBy}</div>
          </div>
        ))}
      </div>

      {/* md+: table. */}
      <div className="hidden overflow-x-auto rounded-xl bg-surface shadow-soft ring-1 ring-beige-300 md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-beige-300 bg-beige-200/50 text-xs uppercase tracking-wide text-brown-600">
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Clinic</th>
              <th className="px-4 py-3 font-medium">Detail</th>
              <th className="px-4 py-3 font-medium">By</th>
              <th className="px-4 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-beige-300 last:border-0">
                <td className="px-4 py-3">
                  <ActionBadge action={entry.action} />
                </td>
                <td className="px-4 py-3 text-brown-900">{entry.clinicName ?? "Platform-wide"}</td>
                <td className="px-4 py-3 text-brown-700">{entry.detail}</td>
                <td className="px-4 py-3 text-brown-600">{entry.performedBy}</td>
                <td className="px-4 py-3 text-brown-600">{formatDateTime(entry.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
