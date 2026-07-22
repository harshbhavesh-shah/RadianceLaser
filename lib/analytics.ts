import "server-only";
import type { Package, Patient, SessionType, StatsWindow, Visit } from "@/types";

export function todayLocalStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isOnOrAfterLocalDate(epochMs: number, dateStr: string): boolean {
  return epochMs >= new Date(`${dateStr}T00:00:00`).getTime();
}

/** Start date (inclusive, YYYY-MM-DD) of the given window, ending today. */
function windowStartStr(window: StatsWindow): string {
  const now = new Date();
  if (window === "today") return todayLocalStr();
  if (window === "week") {
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay()); // Sunday start, matches lib/calendar.ts
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  }
  // month
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export function feeOf(visit: Visit): number {
  // Package-redeemed visits are always fee 0 (see VisitFormModal) — the
  // money was already counted as revenue on the package's purchase date,
  // so this deliberately does NOT need special-casing here to avoid
  // double-counting; it just naturally contributes nothing.
  const fee = visit.fields?.fee;
  return typeof fee === "number" ? fee : Number(fee) || 0;
}

export interface WindowStats {
  window: StatsWindow;
  visitsInWindow: number;
  newPatientsInWindow: number;
  revenueInWindow: number;
  totalPatients: number;
}

/**
 * The stats every role sees, regardless of permissions — a snapshot over
 * the clinic's configured window (Settings → Dashboard Preferences),
 * defaulting to "today" if never set.
 */
export function computeWindowStats(
  patients: Patient[],
  visits: Visit[],
  packages: Package[] = [],
  window: StatsWindow = "today"
): WindowStats {
  const startStr = windowStartStr(window);
  const visitsInWindow = visits.filter((v) => v.date >= startStr);
  const newPatientsInWindow = patients.filter((p) => isOnOrAfterLocalDate(p.createdAt, startStr));
  const packagesInWindow = packages.filter((p) => p.purchaseDate >= startStr);

  return {
    window,
    visitsInWindow: visitsInWindow.length,
    newPatientsInWindow: newPatientsInWindow.length,
    revenueInWindow:
      visitsInWindow.reduce((sum, v) => sum + feeOf(v), 0) +
      packagesInWindow.reduce((sum, p) => sum + p.totalAmount, 0),
    totalPatients: patients.length,
  };
}

export interface RecentActivityItem {
  visitId: string;
  patientId: string;
  patientName: string;
  sessionType: SessionType;
  date: string;
  fee: number;
  createdAt: number;
}

/** Most recently *entered* visits (not most recent visit date) — reflects
 * actual system activity, so a backdated entry doesn't jump the queue. */
export function computeRecentActivity(
  visits: Visit[],
  patientsById: Map<string, Patient>,
  limit = 8
): RecentActivityItem[] {
  return [...visits]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map((v) => ({
      visitId: v.id,
      patientId: v.patientId,
      patientName: patientsById.get(v.patientId)?.name || "Unknown patient",
      sessionType: v.sessionType,
      date: v.date,
      fee: feeOf(v),
      createdAt: v.createdAt,
    }));
}

export interface MonthlyRevenue {
  monthLabel: string;
  total: number;
  byDay: { day: number; total: number }[];
  byType: Record<SessionType, number>;
}

/** Doctor/owner-only monthly revenue breakdown — current calendar month.
 * Includes both visit fees and package purchases (counted on their
 * purchase date, not spread across redemptions — see feeOf() above). */
export function computeMonthlyRevenue(visits: Visit[], packages: Package[] = []): MonthlyRevenue {
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const monthVisits = visits.filter((v) => v.date?.startsWith(monthPrefix));
  const monthPackages = packages.filter((p) => p.purchaseDate?.startsWith(monthPrefix));

  const byDayMap = new Map<number, number>();
  // Seeded with the two built-ins so they always show in the "By Treatment
  // Type" breakdown even with zero revenue; clinic-defined machine types
  // (e.g. "co2") get added dynamically below as they show up in the data.
  const byType: Record<SessionType, number> = { qs: 0, lhr: 0 };

  for (const v of monthVisits) {
    const fee = feeOf(v);
    const day = Number(v.date.split("-")[2]);
    byDayMap.set(day, (byDayMap.get(day) || 0) + fee);
    byType[v.sessionType] = (byType[v.sessionType] || 0) + fee;
  }

  for (const p of monthPackages) {
    const day = Number(p.purchaseDate.split("-")[2]);
    byDayMap.set(day, (byDayMap.get(day) || 0) + p.totalAmount);
    byType[p.sessionType] = (byType[p.sessionType] || 0) + p.totalAmount;
  }

  const byDay = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    total: byDayMap.get(i + 1) || 0,
  }));

  return {
    monthLabel: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    total:
      monthVisits.reduce((sum, v) => sum + feeOf(v), 0) +
      monthPackages.reduce((sum, p) => sum + p.totalAmount, 0),
    byDay,
    byType,
  };
}
