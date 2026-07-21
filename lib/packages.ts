import type { Package, PackageStatus, Visit } from "@/types";

/** Per-session value, derived from what the patient actually paid — not a
 * separately-entered "price per session" field, so it can never drift out
 * of sync with the package's real total. */
export function perSessionValue(pkg: Package): number {
  return pkg.totalSessions > 0 ? pkg.totalAmount / pkg.totalSessions : 0;
}

export interface PackageLedgerEntry {
  visitId: string;
  date: string;
  amount: number;
  sessionNumber: number; // 1-indexed, in redemption order
}

export interface PackageLedger {
  sessionsUsed: number;
  sessionsRemaining: number;
  amountUsed: number;
  amountRemaining: number;
  perSession: number;
  status: PackageStatus;
  entries: PackageLedgerEntry[];
}

/**
 * Computes everything about a package's usage from its linked Visits —
 * deliberately derived, not stored, so the ledger can never drift out of
 * sync with what was actually logged. Pass in ALL of a patient's visits;
 * this filters to the ones linked to this specific package itself.
 */
export function computePackageLedger(pkg: Package, allPatientVisits: Visit[]): PackageLedger {
  const linked = allPatientVisits
    .filter((v) => v.packageId === pkg.id)
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || a.createdAt - b.createdAt);

  const perSession = perSessionValue(pkg);
  const entries: PackageLedgerEntry[] = linked.map((v, i) => ({
    visitId: v.id,
    date: v.date,
    amount: perSession,
    sessionNumber: i + 1,
  }));

  const sessionsUsed = entries.length;
  const sessionsRemaining = Math.max(pkg.totalSessions - sessionsUsed, 0);
  const amountUsed = perSession * sessionsUsed;
  const amountRemaining = Math.max(pkg.totalAmount - amountUsed, 0);

  let status: PackageStatus = "active";
  if (sessionsRemaining <= 0) {
    status = "completed";
  } else if (pkg.expiryDate && pkg.expiryDate < todayLocalStr()) {
    status = "expired";
  }

  return { sessionsUsed, sessionsRemaining, amountUsed, amountRemaining, perSession, status, entries };
}

export function todayLocalStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}