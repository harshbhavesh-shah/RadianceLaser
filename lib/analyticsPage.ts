import "server-only";
import { feeOf, todayLocalStr } from "@/lib/analytics";
import type { Machine, Package, SessionType, Visit } from "@/types";

type Window = "day" | "week" | "month" | "year";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function startDateForWindow(window: Window): string {
  const now = new Date();
  if (window === "day") return todayLocalStr();
  if (window === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay()); // Sunday start, matches lib/calendar.ts
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  if (window === "month") return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  return `${now.getFullYear()}-01-01`;
}

export interface RevenueSummaryEntry {
  total: number;
  packageRevenue: number; // package purchases made within this window
  directRevenue: number; // pay-per-visit fees within this window
}

export interface RevenueSummary {
  day: RevenueSummaryEntry;
  week: RevenueSummaryEntry;
  month: RevenueSummaryEntry;
  year: RevenueSummaryEntry;
}

function summarizeWindow(visits: Visit[], packages: Package[], window: Window): RevenueSummaryEntry {
  const start = startDateForWindow(window);
  const directRevenue = visits
    .filter((v) => v.date >= start && !v.packageId)
    .reduce((sum, v) => sum + feeOf(v), 0);
  const packageRevenue = packages
    .filter((p) => p.purchaseDate >= start)
    .reduce((sum, p) => sum + p.totalAmount, 0);
  return { total: directRevenue + packageRevenue, packageRevenue, directRevenue };
}

/** Total/package/direct revenue for all four windows at once — the top-row
 * stat cards on the Analytics page. */
export function computeRevenueSummary(visits: Visit[], packages: Package[]): RevenueSummary {
  return {
    day: summarizeWindow(visits, packages, "day"),
    week: summarizeWindow(visits, packages, "week"),
    month: summarizeWindow(visits, packages, "month"),
    year: summarizeWindow(visits, packages, "year"),
  };
}

export interface MonthPoint {
  monthLabel: string;
  total: number;
}

/** 12-point revenue trend for the current calendar year — the main chart
 * on the Analytics page. */
export function computeYearlyRevenueTrend(visits: Visit[], packages: Package[]): MonthPoint[] {
  const now = new Date();
  const year = now.getFullYear();
  const totals = Array(12).fill(0);

  for (const v of visits) {
    if (!v.date?.startsWith(String(year)) || v.packageId) continue;
    const month = Number(v.date.split("-")[1]) - 1;
    totals[month] += feeOf(v);
  }
  for (const p of packages) {
    if (!p.purchaseDate?.startsWith(String(year))) continue;
    const month = Number(p.purchaseDate.split("-")[1]) - 1;
    totals[month] += p.totalAmount;
  }

  return totals.map((total, i) => ({
    monthLabel: new Date(year, i, 1).toLocaleDateString("en-US", { month: "short" }),
    total,
  }));
}

// Keyed by SessionType — built-in "qs"/"lhr" plus whatever clinic-defined
// machine types (e.g. "co2") exist. A plain Record rather than a fixed
// shape since the set of types is per-clinic and open-ended.
export type RevenueByType = Record<SessionType, number>;

/** Revenue split by treatment type, current year — feeds the pie chart. */
export function computeRevenueByType(visits: Visit[], packages: Package[]): RevenueByType {
  const year = new Date().getFullYear();
  const byType: RevenueByType = {};

  for (const v of visits) {
    if (!v.date?.startsWith(String(year)) || v.packageId) continue;
    byType[v.sessionType] = (byType[v.sessionType] || 0) + feeOf(v);
  }
  for (const p of packages) {
    if (!p.purchaseDate?.startsWith(String(year))) continue;
    byType[p.sessionType] = (byType[p.sessionType] || 0) + p.totalAmount;
  }
  return byType;
}

export interface StaffMachineStat {
  staffName: string;
  machineName: string;
  sessionCount: number;
  totalMinutes: number;
}

/** Who operated which machine, and for how long — only reflects visits
 * logged with this attribution filled in (see VisitFormModal's Machine /
 * Performed By / Duration fields), so this can be sparse for clinics that
 * just turned this on. */
export function computeStaffMachineStats(visits: Visit[], machines: Machine[]): StaffMachineStat[] {
  const machinesById = new Map(machines.map((m) => [m.id, m]));
  const grouped = new Map<string, StaffMachineStat>();

  for (const v of visits) {
    if (!v.performedByName && !v.machineId) continue; // nothing to attribute

    const staffName = v.performedByName || "Unassigned";
    const machineName = v.machineId ? machinesById.get(v.machineId)?.name || "Unknown Machine" : "Unspecified";
    const key = `${staffName}__${machineName}`;

    const existing = grouped.get(key);
    if (existing) {
      existing.sessionCount += 1;
      existing.totalMinutes += v.durationMinutes || 0;
    } else {
      grouped.set(key, {
        staffName,
        machineName,
        sessionCount: 1,
        totalMinutes: v.durationMinutes || 0,
      });
    }
  }

  return [...grouped.values()].sort((a, b) => b.totalMinutes - a.totalMinutes);
}

export interface AreaStat {
  area: string;
  count: number;
}

function normalizeArea(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase()); // title case for display
}

/** Which treated body areas come up most often, across both QS and LHR.
 * Area is free text, not a fixed list, so this normalizes casing/spacing
 * before grouping — "underarms", "Underarms ", "UNDERARMS" all count as one. */
export function computeAreaPopularity(visits: Visit[], limit = 10): AreaStat[] {
  const counts = new Map<string, number>();

  for (const v of visits) {
    const raw = v.fields?.area;
    if (typeof raw !== "string" || !raw.trim()) continue;
    const normalized = normalizeArea(raw);
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
