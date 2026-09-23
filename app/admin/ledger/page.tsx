import { getLedgerEntries } from "@/lib/db/ledger";
import LedgerClient from "@/components/admin/LedgerClient";

export default async function AdminLedgerPage() {
  const entries = await getLedgerEntries();

  return (
    <div>
      <h1 className="inline-block border-b-4 border-rust-600 pb-1 font-display text-2xl font-bold text-brown-900">
        Ledger
      </h1>
      <p className="mt-3 text-sm text-brown-400">
        What running Lumière by Radiance itself costs and earns, separate from any clinic's own data.
      </p>

      <div className="mt-8">
        <LedgerClient initialEntries={entries} />
      </div>
    </div>
  );
}
