import "server-only";
import type { Package, Patient, SessionType, Visit } from "@/types";

export function todayLocalStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameLocalDay(epochMs: number, dateStr: string): boolean {
  const d = new Date(epochMs);
  const asStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return asStr === dateStr;
}

function feeOf(visit: Visit): number {
  // Package-redeemed visits are always fee 0 (see VisitFormModal) — the
  // money was already counted as revenue on the package's purchase date,
  // so this deliberately does NOT need special-casing here to avoid
  // double-counting; it just naturally contributes nothing.
  const fee = visit.fields?.fee;
  return typeof fee === "number" ? fee : Number(fee) || 0;
}

export interface TodayStats {
  visitsToday: number;
  newPatientsToday: number;
  revenueToday: number;
  totalPatients: number;
}

/**
 * The stats every role sees, regardless of permissions — deliberately just
 * a same-day snapshot, not a breakdown. Defaults to "today"; once a
 * settings page exists, the window (today/week/month) should become a
 * per-clinic preference read here instead of hardcoded.
 */
export function computeTodayStats(
  patients: Patient[],
  visits: Visit[],
  packages: Package[] = []
): TodayStats {
  const today = todayLocalStr();
  const visitsToday = visits.filter((v) => v.date === today);
  const newPatientsToday = patients.filter((p) => isSameLocalDay(p.createdAt, today));
  const packagesToday = packages.filter((p) => p.purchaseDate === today);

  return {
    visitsToday: visitsToday.length,
    newPatientsToday: newPatientsToday.length,
    revenueToday:
      visitsToday.reduce((sum, v) => sum + feeOf(v), 0) +
      packagesToday.reduce((sum, p) => sum + p.totalAmount, 0),
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