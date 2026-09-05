import { getLedgerEntries } from "@/lib/db/ledger";
import LedgerClient from "@/components/admin/LedgerClient";

export default async function AdminLedgerPage() {
  const entries = await getLedgerEntries();

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-brown-900">Ledger</h1>
      <p className="mt-1 text-sm text-brown-400">
        What running Radiance Laser itself costs and earns — separate from any clinic's own data.
      </p>
      <div className="mt-2 mb-6 h-[2px] w-8 bg-gold-500" />

      <LedgerClient initialEntries={entries} />
    </div>
  );
}
