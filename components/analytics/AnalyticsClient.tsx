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
import PieChart from "./PieChart";
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

/** Owns the Analytics page's date-range toggle — everything below it
 * recomputes client-side from the raw visits/packages/appointments/
 * patients the server fetched once, so switching Week/Month/Quarter/
 * Custom is instant, no refetch (see lib/analyticsRange.ts). */
export default function AnalyticsClient({
  visits,
  packages,
  appointments,
  patients,
}: {
  visits: Visit[];
  packages: Package[];
  appointments: Appointment[];
  patients: Patient[];
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const [preset, setPreset] = useState<AnalyticsRangePreset>("month");
  const today = new Date().toISOString().slice(0, 10);
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(today);

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

  const statusTotal = stats.statusCounts.completed + stats.statusCounts.cancelled + stats.statusCounts.noShow;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="inline-block border-b-4 border-rust-600 pb-1 font-display text-2xl font-bold text-brown-900">
          Analytics
        </h1>
        <div className="flex flex-wrap items-center gap-3">
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
            <span className="text-xs font-semibold uppercase tracking-wide text-brown-400">Total Appointments</span>
            <TrendPill pct={pctChange(stats.totalAppointments, prevStats.totalAppointments)} />
          </div>
          <div className="mt-2 font-display text-3xl font-bold text-brown-900">{stats.totalAppointments}</div>
        </div>
        <div className="rounded-2xl border border-beige-300 bg-surface p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-brown-400">New Patients</span>
            <TrendPill pct={pctChange(stats.newPatients, prevStats.newPatients)} />
          </div>
          <div className="mt-2 font-display text-3xl font-bold text-brown-900">{stats.newPatients}</div>
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
          <h2 className="font-display text-lg font-semibold text-brown-900">Appointment Status</h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-rust-600" />
          {statusTotal === 0 ? (
            <p className="text-sm text-brown-400">No resolved appointments in this range.</p>
          ) : (
            <PieChart
              formatValue={(n) => String(n)}
              centerLabel={{ value: String(statusTotal), caption: "Total" }}
              segments={[
                {
                  label: "Completed",
                  value: stats.statusCounts.completed,
                  color: "#3F7D58",
                  sublabel: "appointments",
                },
                {
                  label: "Cancelled",
                  value: stats.statusCounts.cancelled,
                  color: "#C1442D",
                  sublabel: "appointments",
                },
                {
                  label: "No-show",
                  value: stats.statusCounts.noShow,
                  color: "#9C8672",
                  sublabel: "appointments",
                },
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
}
