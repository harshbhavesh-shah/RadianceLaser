import { getAdminAuditLogEntries } from "@/lib/db/adminAuditLog";
import AuditLogTable from "@/components/admin/AuditLogTable";

export default async function AdminAuditLogPage() {
  const entries = await getAdminAuditLogEntries();

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-brown-900">Audit Log</h1>
      <p className="mt-1 text-sm text-brown-400">
        Every manual override — extended, activated, terminated, deleted, or a price change — who did it and when.
      </p>
      <div className="mt-2 mb-6 h-[2px] w-8 bg-gold-500" />

      <AuditLogTable entries={entries} />
    </div>
  );
}
