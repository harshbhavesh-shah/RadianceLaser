import type { getAuditLogs } from "@/lib/db/auditLog";

type AuditLogEntry = Awaited<ReturnType<typeof getAuditLogs>>[number];

// Maps the dot-namespaced action strings actions.ts files write (e.g.
// "patient.erase") to plain English — see lib/db/auditLog.ts's callers for
// the full current set. An action not in this map (a newer one added
// later and not yet given a label) still renders, just as its raw string,
// rather than disappearing or crashing.
const ACTION_LABELS: Record<string, string> = {
  "patient.create": "Created patient",
  "patient.update": "Updated patient",
  "patient.erase": "Erased patient (DPDP right to erasure)",
  "visit.create": "Logged a visit",
  "visit.update": "Edited a visit",
  "visit.delete": "Deleted a visit",
  "consentForm.sign": "Signed a consent form",
  "consentForm.delete": "Deleted a consent form",
  "receipt.create": "Issued a receipt",
  "receipt.delete": "Deleted a receipt",
  "patientPhoto.create": "Uploaded a photo",
  "patientPhoto.delete": "Deleted a photo",
};

/** A short, human-readable detail pulled from an entry's metadata — e.g.
 * "Q-Switch" for a visit, "RCPT-000042" for a receipt. Falls back to
 * nothing (just the targetType shows) for actions with no metadata worth
 * summarizing this way, or metadata shapes this doesn't recognize. */
function metadataDetail(entry: AuditLogEntry): string | null {
  const m = entry.metadata;
  if (!m) return null;
  if (typeof m.sessionType === "string") return m.sessionType;
  if (typeof m.receiptNumber === "string") return m.receiptNumber;
  if (typeof m.templateTitle === "string") return m.templateTitle;
  return null;
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Read-only view of lib/db/auditLog.ts's CERT-In 2022 / DPDP compliance
 * log — who touched what patient record, and when. That log has been
 * written to since patient create/update/erase were built, but had no
 * viewer anywhere until now: data was being collected for a compliance
 * need nobody could actually produce on request. Owner-only, matching
 * every other account-level (not day-to-day clinical) section here. */
export default function ActivityLogSection({ entries }: { entries: AuditLogEntry[] }) {
  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <h2 className="font-display text-lg font-medium text-brown-900">Activity Log</h2>
      <p className="mt-1 text-sm text-brown-400">
        Who touched patient records, and when — for CERT-In / DPDP compliance requests.
      </p>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-brown-400">No activity recorded yet.</p>
      ) : (
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-3 rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="font-medium text-brown-900">{ACTION_LABELS[entry.action] ?? entry.action}</div>
                <div className="truncate text-xs text-brown-400">
                  {entry.targetType}
                  {metadataDetail(entry) ? ` (${metadataDetail(entry)})` : ""} · {entry.actorName} (
                  {entry.actorRole})
                </div>
              </div>
              <div className="flex-shrink-0 text-xs text-brown-500">{formatDateTime(entry.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
