import "server-only";
import type { Package, SessionType, Visit } from "@/types";

export function todayLocalStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function feeOf(visit: Visit): number {
  // Package-redeemed visits are always fee 0 (see VisitFormModal) — the
  // money was already counted as revenue on the package's purchase date,
  // so this deliberately does NOT need special-casing here to avoid
  // double-counting; it just naturally contributes nothing.
  const fee = visit.fields?.fee;
  return typeof fee === "number" ? fee : Number(fee) || 0;
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
