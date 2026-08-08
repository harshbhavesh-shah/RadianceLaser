import "server-only";
import { feeOf, todayLocalStr } from "@/lib/analytics";
import { computePackageLedger } from "@/lib/packages";
import type { Appointment, Machine, Package, SessionType, Visit } from "@/types";

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
    // A multi-area visit's rolled-up `fields.area` is a comma-joined list
    // (e.g. "Chin, Upper Lips" — see lib/visitAreas.ts) — split it back out
    // so each treated area still counts individually here, rather than the
    // whole combination being tallied as one distinct "area".
    for (const part of raw.split(",")) {
      if (!part.trim()) continue;
      const normalized = normalizeArea(part);
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export interface CashFlowSummary {
  cash: number;
  online: number;
  // Money from visits/packages that predate PaymentMethod, or where it was
  // left blank (it's optional) — shown as its own bucket rather than
  // silently folded into either real one, so the split stays honest about
  // what's actually known.
  unspecified: number;
  total: number;
}

/** How this year's money actually came in — cash vs online — across both
 * direct-pay visits and package purchases. Separate from the direct/package
 * *source* split (computeRevenueSummary) — this is about payment method,
 * not what was paid for. */
export function computeCashFlowSummary(visits: Visit[], packages: Package[]): CashFlowSummary {
  const year = new Date().getFullYear();
  let cash = 0;
  let online = 0;
  let unspecified = 0;

  for (const v of visits) {
    if (!v.date?.startsWith(String(year)) || v.packageId) continue;
    const fee = feeOf(v);
    if (v.paymentMethod === "cash") cash += fee;
    else if (v.paymentMethod === "online") online += fee;
    else unspecified += fee;
  }
  for (const p of packages) {
    if (!p.purchaseDate?.startsWith(String(year))) continue;
    if (p.paymentMethod === "cash") cash += p.totalAmount;
    else if (p.paymentMethod === "online") online += p.totalAmount;
    else unspecified += p.totalAmount;
  }

  return { cash, online, unspecified, total: cash + online + unspecified };
}

export interface AppointmentReliability {
  totalPast: number; // completed + cancelled + no-show this year, date already happened
  completed: number;
  cancelled: number;
  noShow: number;
  noShowRate: number; // 0-100
  cancellationRate: number; // 0-100
}

/** No-show and cancellation rates, this year — only counts appointments
 * whose date has actually passed AND have a resolved status (completed,
 * cancelled, or no-show). A still-"booked" appointment in the past means
 * nobody updated it after the fact — deliberately excluded rather than
 * guessed at either way. */
export function computeAppointmentReliability(appointments: Appointment[]): AppointmentReliability {
  const year = new Date().getFullYear();
  const today = todayLocalStr();

  const past = appointments.filter(
    (a) => a.date?.startsWith(String(year)) && a.date <= today && a.status !== "booked"
  );
  const completed = past.filter((a) => a.status === "completed").length;
  const cancelled = past.filter((a) => a.status === "cancelled").length;
  const noShow = past.filter((a) => a.status === "no-show").length;
  const totalPast = past.length;

  return {
    totalPast,
    completed,
    cancelled,
    noShow,
    noShowRate: totalPast > 0 ? (noShow / totalPast) * 100 : 0,
    cancellationRate: totalPast > 0 ? (cancelled / totalPast) * 100 : 0,
  };
}

export interface PackageUtilizationSummary {
  packagesSold: number;
  sessionsSold: number;
  sessionsUsed: number;
  sessionsRemainingActive: number; // still redeemable — package isn't expired
  sessionsLostToExpiry: number; // "breakage" — paid for, never used, can't be anymore
  utilizationRate: number; // 0-100
  breakageRate: number; // 0-100
}

/** All-time package usage, not year-scoped — a package bought last year can
 * still expire (or get used up) this year, so slicing this by purchase year
 * would split a single package's story across two periods for no reason.
 * Reuses computePackageLedger (lib/packages.ts) rather than recomputing
 * usage from scratch, so this can never disagree with what a patient's own
 * package tab shows. */
export function computePackageUtilization(packages: Package[], visits: Visit[]): PackageUtilizationSummary {
  let sessionsSold = 0;
  let sessionsUsed = 0;
  let sessionsRemainingActive = 0;
  let sessionsLostToExpiry = 0;

  for (const pkg of packages) {
    const ledger = computePackageLedger(pkg, visits);
    sessionsSold += pkg.totalSessions;
    sessionsUsed += ledger.sessionsUsed;
    if (ledger.status === "expired") {
      sessionsLostToExpiry += ledger.sessionsRemaining;
    } else {
      sessionsRemainingActive += ledger.sessionsRemaining;
    }
  }

  return {
    packagesSold: packages.length,
    sessionsSold,
    sessionsUsed,
    sessionsRemainingActive,
    sessionsLostToExpiry,
    utilizationRate: sessionsSold > 0 ? (sessionsUsed / sessionsSold) * 100 : 0,
    breakageRate: sessionsSold > 0 ? (sessionsLostToExpiry / sessionsSold) * 100 : 0,
  };
}
