import { computePackageLedger } from "@/lib/packages";
import type { Package, Visit } from "@/types";

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-rust-100 text-rust-700",
  completed: "bg-beige-300 text-brown-600",
  expired: "bg-red-50 text-red-700",
};

export default function PackageCard({
  pkg,
  visits,
  onRedeem,
}: {
  pkg: Package;
  visits: Visit[];
  onRedeem: () => void;
}) {
  const ledger = computePackageLedger(pkg, visits);
  const usedPct = Math.min((ledger.sessionsUsed / pkg.totalSessions) * 100, 100);

  return (
    <div className="rounded-2xl border border-beige-300 bg-surface p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-display text-base font-medium text-brown-900">{pkg.label}</div>
          <div className="mt-0.5 text-xs text-brown-400">
            Purchased {pkg.purchaseDate} · {formatCurrency(pkg.totalAmount)} for {pkg.totalSessions}{" "}
            sessions
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[ledger.status]}`}
        >
          {ledger.status}
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="text-brown-600">
            {ledger.sessionsUsed} of {pkg.totalSessions} sessions used
          </span>
          <span className="font-medium text-brown-900">
            {ledger.sessionsRemaining} remaining
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-beige-200">
          <div className="h-full rounded-full bg-rust-600" style={{ width: `${usedPct}%` }} />
        </div>
        <div className="mt-1.5 text-xs text-brown-400">
          {formatCurrency(ledger.amountRemaining)} remaining of {formatCurrency(pkg.totalAmount)}
        </div>
      </div>

      {ledger.entries.length > 0 && (
        <div className="mt-4 border-t border-beige-300 pt-3">
          <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-brown-400">
            Redemption Ledger
          </div>
          <div className="space-y-1">
            {ledger.entries.map((entry) => (
              <div key={entry.visitId} className="flex justify-between text-sm">
                <span className="text-brown-600">
                  Session {entry.sessionNumber} ({entry.date || "No date"})
                </span>
                <span className="text-brown-900">{formatCurrency(entry.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {ledger.status === "active" && (
        <button
          onClick={onRedeem}
          className="mt-4 w-full rounded-lg border border-rust-600 py-2 text-sm font-medium text-rust-700 transition-colors hover:bg-rust-100"
        >
          Redeem Session
        </button>
      )}
    </div>
  );
}