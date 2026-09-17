import "server-only";
import { feeOf, todayLocalStr } from "@/lib/analytics";
import { computePackageLedger } from "@/lib/packages";
import type { Appointment, Machine, Package, Visit } from "@/types";

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

// Shared with the admin panel's own charts (lib/platformAnalytics.ts,
// components/admin/AdminBarChart.tsx) — a plain "one point per month" shape
// with no clinic-analytics-specific logic left attached to it here since
// computeYearlyRevenueTrend (the function that used to build this for the
// Analytics page) was replaced by lib/analyticsRange.ts's range-aware
// computeRevenueSeries.
export interface MonthPoint {
  monthLabel: string;
  total: number;
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

export interface NoShowStats {
  thisWeek: number;
  thisMonth: number;
  // Rate over the same "resolved appointments" denominator as
  // computeAppointmentReliability, just scoped to this month instead of
  // this year — a clinic wants to know "is this month worse than usual,"
  // not just a running year-to-date number.
  monthRate: number;
}

/** This week/month no-show counts plus this month's rate, for the No
 * Shows page's stat strip. See computeAppointmentReliability's comment for
 * why a still-"booked" past appointment is excluded from the denominator. */
export function computeNoShowStats(appointments: Appointment[]): NoShowStats {
  const today = todayLocalStr();
  const weekStart = startDateForWindow("week");
  const monthStart = startDateForWindow("month");

  const thisWeek = appointments.filter(
    (a) => a.status === "no-show" && a.date >= weekStart && a.date <= today
  ).length;

  const monthNoShows = appointments.filter(
    (a) => a.status === "no-show" && a.date >= monthStart && a.date <= today
  );
  const monthResolved = appointments.filter(
    (a) => a.date >= monthStart && a.date <= today && a.status !== "booked"
  );

  return {
    thisWeek,
    thisMonth: monthNoShows.length,
    monthRate: monthResolved.length > 0 ? (monthNoShows.length / monthResolved.length) * 100 : 0,
  };
}

export interface NoShowWeekPoint {
  weekLabel: string; // e.g. "Aug 4"
  count: number;
}

/** No-show count per week for the last `weeks` weeks (default ~3 months),
 * for the No Shows page's trend chart. Same fixed-length-array-of-buckets
 * shape as computeYearlyRevenueTrend, just keyed by week-start date instead
 * of month index, since "week" has no small fixed index like a month does. */
export function computeNoShowTrend(appointments: Appointment[], weeks = 12): NoShowWeekPoint[] {
  const now = new Date();
  const currentWeekStart = new Date(now);
  currentWeekStart.setHours(0, 0, 0, 0);
  currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay()); // Sunday, matches lib/calendar.ts

  const buckets: { start: Date; count: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() - i * 7);
    buckets.push({ start, count: 0 });
  }

  for (const a of appointments) {
    if (a.status !== "no-show" || !a.date) continue;
    const apptDate = new Date(`${a.date}T00:00:00`);
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (apptDate >= buckets[i].start) {
        buckets[i].count++;
        break;
      }
    }
  }

  return buckets.map((b) => ({
    weekLabel: b.start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    count: b.count,
  }));
}

export interface PackageUtilizationSummary {
  packagesSold: number;
  sessionsSold: number;
  sessionsUsed: number;
  sessionsRemainingActive: number; // still redeemable — package isn't expired
  sessionsLostToExpiry: number; // "breakage" — paid for, never used, can't be anymore
  utilizationRate: number; // 0-100
  breakageRate: number; // 0-100
  // sessionsLostToExpiry priced at each package's own per-session rate
  // (totalAmount / totalSessions) rather than a clinic-wide average, so a
  // breakage-heavy premium package isn't diluted by cheap ones — this is
  // the ₹ figure the revenue tab actually cares about, not just a count.
  breakageValue: number;
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
  let breakageValue = 0;

  for (const pkg of packages) {
    const ledger = computePackageLedger(pkg, visits);
    sessionsSold += pkg.totalSessions;
    sessionsUsed += ledger.sessionsUsed;
    if (ledger.status === "expired") {
      sessionsLostToExpiry += ledger.sessionsRemaining;
      const perSessionRate = pkg.totalSessions > 0 ? pkg.totalAmount / pkg.totalSessions : 0;
      breakageValue += ledger.sessionsRemaining * perSessionRate;
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
    breakageValue,
  };
}

export interface PatientRetentionStats {
  treatedPatients: number; // distinct patients with at least one visit
  avgVisitsPerPatient: number;
  activePatients: number; // most recent visit within lapsedAfterDays
  lapsedPatients: number; // has been treated, but not within lapsedAfterDays
}

// How long since a patient's last visit before they count as "lapsed"
// rather than "active" — generous enough that a clinic's normal 4-8 week
// treatment cadence (laser/IPL packages) doesn't misread as churn.
const LAPSED_AFTER_DAYS = 60;

// "consultation" is the hidden built-in session type the public booking
// flow logs a first-touch visit under (see lib/sessionTypes.ts) — never a
// real treatment, so it's excluded here and from computeConsultConversionStats
// below. Kept in sync by hand with that file's own "consultation" key.
const CONSULT_SESSION_TYPE = "consultation";

/** All-time (not range-scoped, same reasoning as computePackageUtilization
 * above) read on how often treated patients actually come back — average
 * visits per patient, and how many of them haven't been seen recently.
 * Patients with zero visits ever are leads/new signups, not "lapsed", so
 * they're excluded from both counts rather than inflating lapsedPatients;
 * same treatment for a patient whose only visit is a consultation — that's
 * a lead who hasn't actually been treated yet, not a lapsed one. */
export function computePatientRetentionStats(
  visits: Visit[],
  todayStr: string = todayLocalStr()
): PatientRetentionStats {
  const lastVisitByPatient = new Map<string, string>();
  const visitCounts = new Map<string, number>();

  for (const v of visits) {
    if (!v.date || v.sessionType === CONSULT_SESSION_TYPE) continue;
    visitCounts.set(v.patientId, (visitCounts.get(v.patientId) || 0) + 1);
    const prev = lastVisitByPatient.get(v.patientId);
    if (!prev || v.date > prev) lastVisitByPatient.set(v.patientId, v.date);
  }

  const cutoff = new Date(`${todayStr}T00:00:00`);
  cutoff.setDate(cutoff.getDate() - LAPSED_AFTER_DAYS);
  const cutoffStr = `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}`;

  let activePatients = 0;
  let lapsedPatients = 0;
  for (const lastDate of lastVisitByPatient.values()) {
    if (lastDate >= cutoffStr) activePatients++;
    else lapsedPatients++;
  }

  const treatedPatients = lastVisitByPatient.size;
  const totalVisits = [...visitCounts.values()].reduce((a, b) => a + b, 0);

  return {
    treatedPatients,
    avgVisitsPerPatient: treatedPatients > 0 ? totalVisits / treatedPatients : 0,
    activePatients,
    lapsedPatients,
  };
}

export interface ConsultConversionStats {
  totalConsults: number; // distinct patients with at least one consultation visit
  converted: number; // of those, how many also have a real (non-consultation) visit
  conversionRate: number; // 0-100
}

/** What fraction of logged consultations actually turned into a real,
 * paid treatment — all-time, same reasoning as computePatientRetentionStats
 * above (a consult from last quarter can still convert this quarter). A
 * patient counts as converted if they have any non-consultation visit at
 * all, regardless of whether it landed before or after the consult visit
 * itself — this app's booking flow always logs the consult first, but
 * nothing here depends on that ordering holding for every clinic's data. */
export function computeConsultConversionStats(visits: Visit[]): ConsultConversionStats {
  const consultPatients = new Set<string>();
  const treatedPatients = new Set<string>();

  for (const v of visits) {
    if (v.sessionType === CONSULT_SESSION_TYPE) consultPatients.add(v.patientId);
    else treatedPatients.add(v.patientId);
  }

  let converted = 0;
  for (const id of consultPatients) {
    if (treatedPatients.has(id)) converted++;
  }

  return {
    totalConsults: consultPatients.size,
    converted,
    conversionRate: consultPatients.size > 0 ? (converted / consultPatients.size) * 100 : 0,
  };
}
