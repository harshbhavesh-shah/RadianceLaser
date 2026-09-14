import { toDateStr, startOfWeek, startOfMonth, addDays } from "@/lib/calendar";
import type { Appointment, Package, Patient, SessionType, Visit } from "@/types";

// No "server-only" — the whole point of this module is to run client-side
// so the Analytics page's date-range toggle can recompute instantly
// against data already sent to the browser, no server round-trip per
// toggle click. Pure functions only, nothing here touches the database.
// (Can't import lib/analytics.ts's feeOf for this — that module is itself
// "server-only", so this small duplicate is the pragmatic tradeoff.)
function feeOf(visit: Visit): number {
  const fee = visit.fields?.fee;
  return typeof fee === "number" ? fee : Number(fee) || 0;
}

export type AnalyticsRangePreset = "week" | "month" | "quarter" | "custom";

export interface DateRange {
  start: string; // YYYY-MM-DD, inclusive
  end: string; // YYYY-MM-DD, inclusive
}

function startOfQuarter(d: Date): Date {
  const quarterStartMonth = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), quarterStartMonth, 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function endOfQuarter(d: Date): Date {
  const quarterStartMonth = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), quarterStartMonth + 3, 0);
}

/** Turns a preset (or a custom pair) into concrete start/end date strings.
 * Week and month match the same Sunday-start/calendar-month convention
 * used everywhere else in the app (lib/calendar.ts) — nothing analytics-
 * specific invented here beyond the quarter case, which this app has no
 * other need for. */
export function resolveRange(preset: AnalyticsRangePreset, custom?: DateRange): DateRange {
  const now = new Date();
  if (preset === "week") {
    const start = startOfWeek(now);
    return { start: toDateStr(start), end: toDateStr(addDays(start, 6)) };
  }
  if (preset === "month") {
    return { start: toDateStr(startOfMonth(now)), end: toDateStr(endOfMonth(now)) };
  }
  if (preset === "quarter") {
    return { start: toDateStr(startOfQuarter(now)), end: toDateStr(endOfQuarter(now)) };
  }
  // custom — fall back to this week if somehow called without a pair
  return custom ?? resolveRange("week");
}

/** The immediately-preceding period of the same length — "last week" for
 * a weekly range, "last month" for a monthly one, etc. — so the stat row
 * can show a real trend arrow instead of a fabricated one. Shifts by the
 * range's own span rather than assuming a fixed unit, so it works the
 * same way for Custom too. */
export function previousRange(range: DateRange): DateRange {
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  const spanDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  return {
    start: toDateStr(addDays(start, -spanDays)),
    end: toDateStr(addDays(start, -1)),
  };
}

function inRange(dateStr: string | undefined, range: DateRange): boolean {
  return !!dateStr && dateStr >= range.start && dateStr <= range.end;
}

export interface RangeStats {
  totalRevenue: number;
  totalAppointments: number;
  newPatients: number;
  revenueByType: Record<SessionType, number>;
  statusCounts: { completed: number; cancelled: number; noShow: number };
}

/** Everything the stat row, "Top Treatments by Revenue" bars, and
 * "Appointment Status" donut need, all for one date range. "Resolved"
 * appointments (completed/cancelled/no-show, date already in range) is
 * the same definition lib/analyticsPage.ts computeAppointmentReliability
 * already uses for its year-scoped version — totalAppointments here is
 * that same count, just range-scoped, so it always equals the sum of the
 * three status counts (no separate "still booked" bucket to reconcile). */
export function computeRangeStats(
  visits: Visit[],
  packages: Package[],
  appointments: Appointment[],
  patients: Patient[],
  range: DateRange
): RangeStats {
  let totalRevenue = 0;
  const revenueByType: Record<SessionType, number> = {};

  for (const v of visits) {
    if (v.packageId || !inRange(v.date, range)) continue;
    const fee = feeOf(v);
    totalRevenue += fee;
    revenueByType[v.sessionType] = (revenueByType[v.sessionType] || 0) + fee;
  }
  for (const p of packages) {
    if (!inRange(p.purchaseDate, range)) continue;
    totalRevenue += p.totalAmount;
    revenueByType[p.sessionType] = (revenueByType[p.sessionType] || 0) + p.totalAmount;
  }

  const today = toDateStr(new Date());
  const resolved = appointments.filter(
    (a) => inRange(a.date, range) && a.date <= today && a.status !== "booked"
  );
  const statusCounts = {
    completed: resolved.filter((a) => a.status === "completed").length,
    cancelled: resolved.filter((a) => a.status === "cancelled").length,
    noShow: resolved.filter((a) => a.status === "no-show").length,
  };

  const newPatients = patients.filter((p) => inRange(toDateStr(new Date(p.createdAt)), range)).length;

  return {
    totalRevenue,
    totalAppointments: resolved.length,
    newPatients,
    revenueByType,
    statusCounts,
  };
}

export interface RevenueSeriesPoint {
  label: string;
  total: number;
}

/** Revenue over the selected range, auto-bucketed so the chart never ends
 * up with either one bar (a single-day custom range) or hundreds (a
 * multi-year custom range): by day when the range spans up to 45 days
 * (covers Week and Month), by week beyond that (covers Quarter and any
 * longer custom range) — the same fixed-buckets-across-a-span approach
 * lib/analyticsPage.ts computeNoShowTrend already uses for its own chart,
 * just generalized to an arbitrary range instead of a fixed last-N-weeks. */
export function computeRevenueSeries(visits: Visit[], packages: Package[], range: DateRange): RevenueSeriesPoint[] {
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  const spanDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const byDay = spanDays <= 45;

  const revenueOnDate = (dateStr: string): number => {
    const visitTotal = visits
      .filter((v) => !v.packageId && v.date === dateStr)
      .reduce((sum, v) => sum + feeOf(v), 0);
    const packageTotal = packages
      .filter((p) => p.purchaseDate === dateStr)
      .reduce((sum, p) => sum + p.totalAmount, 0);
    return visitTotal + packageTotal;
  };

  if (byDay) {
    const points: RevenueSeriesPoint[] = [];
    for (let i = 0; i < spanDays; i++) {
      const d = addDays(start, i);
      points.push({
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        total: revenueOnDate(toDateStr(d)),
      });
    }
    return points;
  }

  // Weekly buckets — each bucket's total is the sum of every day that
  // falls within it, not just its first day.
  const points: RevenueSeriesPoint[] = [];
  let bucketStart = new Date(start);
  while (bucketStart <= end) {
    const bucketEnd = addDays(bucketStart, 6) > end ? end : addDays(bucketStart, 6);
    let total = 0;
    for (let d = new Date(bucketStart); d <= bucketEnd; d = addDays(d, 1)) {
      total += revenueOnDate(toDateStr(d));
    }
    points.push({
      label: bucketStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      total,
    });
    bucketStart = addDays(bucketStart, 7);
  }
  return points;
}
