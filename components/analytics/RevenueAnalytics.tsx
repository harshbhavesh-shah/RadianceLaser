"use client";

import { useMemo, useState } from "react";
import {
  resolveRange,
  previousRange,
  computeRangeStats,
  computeRevenueSeries,
  type AnalyticsRangePreset,
  type DateRange,
} from "@/lib/analyticsRange";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import RevenueLineChart from "./RevenueLineChart";
import type { CashFlowSummary, PackageUtilizationSummary } from "@/lib/analyticsPage";
import type { Appointment, Package, Patient, Visit } from "@/types";

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function pctChange(current: number, previous: number): number | null {
  return previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
}

const PRESETS: { key: AnalyticsRangePreset; label: string }[] = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "quarter", label: "This Quarter" },
  { key: "custom", label: "Custom" },
];

function TrendPill({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
        up ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
      }`}
    >
      {up ? "↗" : "↘"} {Math.abs(pct)}%
    </span>
  );
}

/** Everything connected to money: the range-scoped KPIs/revenue chart/top
 * treatments (own date-range toggle, independent of the Procedural tab's),
 * plus a this-year Cash Flow split and an all-time Package Utilization
 * read — those two stay on their own natural timeframe rather than being
 * forced into the toggle, same reasoning the single-page version used to
 * document (a package bought last year can still expire this year; "cash
 * vs online" is a whole-year bookkeeping question, not a weekly one). */
export default function RevenueAnalytics({
  visits,
  packages,
  appointments,
  patients,
  cashFlow,
  packageUtilization,
}: {
  visits: Visit[];
  packages: Package[];
  appointments: Appointment[];
  patients: Patient[];
  cashFlow: CashFlowSummary;
  packageUtilization: PackageUtilizationSummary;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const [preset, setPreset] = useState<AnalyticsRangePreset>("month");
  const today = new Date().toISOString().slice(0, 10);
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(today);
  const currentYear = new Date().getFullYear();

  const range: DateRange = useMemo(
    () => resolveRange(preset, { start: customStart, end: customEnd }),
    [preset, customStart, customEnd]
  );

  const stats = useMemo(
    () => computeRangeStats(visits, packages, appointments, patients, range),
    [visits, packages, appointments, patients, range]
  );
  const prevStats = useMemo(
    () => computeRangeStats(visits, packages, appointments, patients, previousRange(range)),
    [visits, packages, appointments, patients, range]
  );
  const series = useMemo(() => computeRevenueSeries(visits, packages, range), [visits, packages, range]);

  const treatmentBars = Object.entries(stats.revenueByType)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);
  const maxTreatment = Math.max(...treatmentBars.map(([, a]) => a), 1);

  const avgPerVisit = stats.revenueEventCount > 0 ? stats.totalRevenue / stats.revenueEventCount : 0;
  const prevAvgPerVisit = prevStats.revenueEventCount > 0 ? prevStats.totalRevenue / prevStats.revenueEventCount : 0;
  const avgPerPatient = stats.payingPatientCount > 0 ? stats.totalRevenue / stats.payingPatientCount : 0;
  const prevAvgPerPatient =
    prevStats.payingPatientCount > 0 ? prevStats.totalRevenue / prevStats.payingPatientCount : 0;

  const newVsReturningTotal = stats.newPatientRevenue + stats.returningPatientRevenue;

  const cashFlowRows = [
    { label: "Cash", amount: cashFlow.cash, colorClass: "bg-rust-600" },
    { label: "Online", amount: cashFlow.online, colorClass: "bg-brown-700" },
    ...(cashFlow.unspecified > 0
      ? [{ label: "Unspecified", amount: cashFlow.unspecified, colorClass: "bg-beige-300" }]
      : []),
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {preset === "custom" && (
          <div className="flex items-center gap-2 text-sm">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-lg border border-beige-300 bg-surface px-2.5 py-1.5 text-sm text-brown-900 outline-none focus:border-rust-600"
            />
            <span className="text-brown-400">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-lg border border-beige-300 bg-surface px-2.5 py-1.5 text-sm text-brown-900 outline-none focus:border-rust-600"
            />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-beige-300 bg-surface p-1 shadow-soft">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                preset === p.key ? "bg-rust-100 text-rust-700" : "text-brown-600 hover:text-brown-900"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-beige-300 bg-surface p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-brown-400">Total Revenue</span>
            <TrendPill pct={pctChange(stats.totalRevenue, prevStats.totalRevenue)} />
          </div>
          <div className="mt-2 font-display text-3xl font-bold text-brown-900">
            {formatCurrency(stats.totalRevenue)}
          </div>
        </div>
        <div className="rounded-2xl border border-beige-300 bg-surface p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-brown-400">Avg Revenue / Visit</span>
            <TrendPill pct={pctChange(avgPerVisit, prevAvgPerVisit)} />
          </div>
          <div className="mt-2 font-display text-3xl font-bold text-brown-900">{formatCurrency(avgPerVisit)}</div>
        </div>
        <div className="rounded-2xl border border-beige-300 bg-surface p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-brown-400">
              Avg Revenue / Patient
            </span>
            <TrendPill pct={pctChange(avgPerPatient, prevAvgPerPatient)} />
          </div>
          <div className="mt-2 font-display text-3xl font-bold text-brown-900">{formatCurrency(avgPerPatient)}</div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-brown-900">Revenue Over Time</h2>
        <div className="mt-2 mb-5 h-[2px] w-8 bg-rust-600" />
        <RevenueLineChart points={series} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold text-brown-900">Top Treatments by Revenue</h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-rust-600" />
          {treatmentBars.length === 0 ? (
            <p className="text-sm text-brown-400">No revenue logged in this range.</p>
          ) : (
            <div className="space-y-4">
              {treatmentBars.map(([type, amount]) => (
                <div key={type}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-brown-700">{SESSION_TYPE_CONFIG[type]?.label ?? type}</span>
                    <span className="font-medium text-brown-900">{formatCurrency(amount)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-beige-200">
                    <div
                      className="animate-grow-x h-full rounded-full bg-rust-600"
                      style={{ width: `${(amount / maxTreatment) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold text-brown-900">New vs Returning Revenue</h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-rust-600" />
          {newVsReturningTotal === 0 ? (
            <p className="text-sm text-brown-400">No revenue logged in this range.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex h-2.5 overflow-hidden rounded-full bg-beige-200">
                <div
                  className="h-full bg-rust-600"
                  style={{ width: `${(stats.newPatientRevenue / newVsReturningTotal) * 100}%` }}
                />
                <div
                  className="h-full bg-brown-700"
                  style={{ width: `${(stats.returningPatientRevenue / newVsReturningTotal) * 100}%` }}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-brown-700">
                    <span className="h-2 w-2 flex-shrink-0 rounded-full bg-rust-600" />
                    New patients
                  </span>
                  <span className="font-medium text-brown-900">
                    {formatCurrency(stats.newPatientRevenue)}{" "}
                    <span className="font-normal text-brown-400">
                      ({Math.round((stats.newPatientRevenue / newVsReturningTotal) * 100)}%)
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-brown-700">
                    <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brown-700" />
                    Returning patients
                  </span>
                  <span className="font-medium text-brown-900">
                    {formatCurrency(stats.returningPatientRevenue)}{" "}
                    <span className="font-normal text-brown-400">
                      ({Math.round((stats.returningPatientRevenue / newVsReturningTotal) * 100)}%)
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold text-brown-500">More Detail</h2>
        <div className="mt-2 mb-6 h-[2px] w-8 bg-beige-300" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold text-brown-900">Cash Flow ({currentYear})</h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-rust-600" />
          {cashFlow.total === 0 ? (
            <p className="text-sm text-brown-400">
              No revenue logged yet this year. Payment method is set on each visit or package
              purchase. See the Payment Method field when logging a session or selling a
              package.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex h-2.5 overflow-hidden rounded-full bg-beige-200">
                {cashFlowRows.map((row) => (
                  <div
                    key={row.label}
                    className={`h-full ${row.colorClass}`}
                    style={{ width: `${(row.amount / cashFlow.total) * 100}%` }}
                  />
                ))}
              </div>
              <div className="space-y-2">
                {cashFlowRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-brown-700">
                      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${row.colorClass}`} />
                      {row.label}
                    </span>
                    <span className="font-medium text-brown-900">
                      {formatCurrency(row.amount)}{" "}
                      <span className="font-normal text-brown-400">
                        ({Math.round((row.amount / cashFlow.total) * 100)}%)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold text-brown-900">Package Utilization</h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-rust-600" />
          {packageUtilization.sessionsSold === 0 ? (
            <p className="text-sm text-brown-400">No packages sold yet.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="text-brown-400">Packages sold</span>
                  <span className="font-medium text-brown-900">{packageUtilization.packagesSold}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-brown-400">Sessions sold</span>
                  <span className="font-medium text-brown-900">{packageUtilization.sessionsSold}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-brown-400">Sessions used</span>
                  <span className="font-medium text-brown-900">{packageUtilization.sessionsUsed}</span>
                </div>
              </div>
              <div className="mt-5">
                <div className="mb-1.5 flex justify-between text-xs text-brown-400">
                  <span>Utilization</span>
                  <span>{packageUtilization.utilizationRate.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-beige-200">
                  <div
                    className="animate-grow-x h-full rounded-full bg-rust-600"
                    style={{ width: `${packageUtilization.utilizationRate}%` }}
                  />
                </div>
              </div>
              {packageUtilization.breakageRate > 0 && (
                <p className="mt-3 text-xs text-brown-400">
                  {packageUtilization.breakageRate.toFixed(0)}% of sold sessions (
                  {packageUtilization.sessionsLostToExpiry}) expired unused —{" "}
                  <span className="font-medium text-brown-700">
                    {formatCurrency(packageUtilization.breakageValue)}
                  </span>{" "}
                  in lost revenue.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
