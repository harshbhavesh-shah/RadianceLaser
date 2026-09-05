import { getClinicAccess } from "@/lib/subscription";
import type { MonthPoint } from "@/lib/analyticsPage";
import type { Clinic, Payment } from "@/types";

// Platform-level analytics — how the *software business* is doing (clinic
// signups, subscription revenue), as opposed to lib/analyticsPage.ts which
// is one clinic's own treatment/revenue analytics. Backs app/admin/analytics.

export interface ClinicStatusBreakdown {
  active: number;
  trialing: number;
  locked: number;
}

export function computeClinicStatusBreakdown(clinics: Clinic[]): ClinicStatusBreakdown {
  const breakdown: ClinicStatusBreakdown = { active: 0, trialing: 0, locked: 0 };
  for (const clinic of clinics) {
    breakdown[getClinicAccess(clinic).status]++;
  }
  return breakdown;
}

/** New clinic signups per month, current calendar year. */
export function computeSignupTrend(clinics: Clinic[]): MonthPoint[] {
  const now = new Date();
  const year = now.getFullYear();
  const totals = Array(12).fill(0);

  for (const clinic of clinics) {
    const created = new Date(clinic.createdAt);
    if (created.getFullYear() !== year) continue;
    totals[created.getMonth()]++;
  }

  return totals.map((total, i) => ({
    monthLabel: new Date(year, i, 1).toLocaleDateString("en-US", { month: "short" }),
    total,
  }));
}

/** Subscription revenue actually collected per month, current calendar
 * year — converts each payment's paise amount to whole rupees. */
export function computeRevenueTrend(payments: Payment[]): MonthPoint[] {
  const now = new Date();
  const year = now.getFullYear();
  const totals = Array(12).fill(0);

  for (const payment of payments) {
    if (!payment.paidAt) continue;
    const paidAt = new Date(payment.paidAt);
    if (paidAt.getFullYear() !== year) continue;
    totals[paidAt.getMonth()] += payment.amount / 100;
  }

  return totals.map((total, i) => ({
    monthLabel: new Date(year, i, 1).toLocaleDateString("en-US", { month: "short" }),
    total,
  }));
}

/** All-time revenue collected, in whole rupees. */
export function computeTotalRevenue(payments: Payment[]): number {
  return payments.reduce((sum, p) => sum + p.amount / 100, 0);
}
