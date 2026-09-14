import { getAdminAuditLogEntries } from "@/lib/db/adminAuditLog";
import AuditLogTable from "@/components/admin/AuditLogTable";

export default async function AdminAuditLogPage() {
  const entries = await getAdminAuditLogEntries();

  return (
    <div>
      <h1 className="inline-block border-b-4 border-rust-600 pb-1 font-display text-2xl font-bold text-brown-900">
        Audit Log
      </h1>
      <p className="mt-3 text-sm text-brown-400">
        Every manual override (extended, activated, terminated, deleted, or a price change), who did it, and when.
      </p>

      <div className="mt-8">
        <AuditLogTable entries={entries} />
      </div>
    </div>
  );
}
