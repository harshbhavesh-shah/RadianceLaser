import { computePackageLedger } from "@/lib/packages";
import type { Package, Visit } from "@/types";

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-gold-100 text-gold-600",
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
    <div className="rounded-xl bg-surface p-5 shadow-soft ring-1 ring-beige-300">
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
          <div className="h-full rounded-full bg-gold-500" style={{ width: `${usedPct}%` }} />
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
                  Session {entry.sessionNumber} — {entry.date || "No date"}
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
          className="mt-4 w-full rounded-md border border-gold-500 py-2 text-sm font-medium text-gold-600 transition-colors hover:bg-gold-100"
        >
          Redeem Session
        </button>
      )}
    </div>
  );
}