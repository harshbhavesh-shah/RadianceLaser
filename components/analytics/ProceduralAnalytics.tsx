"use client";

import { useMemo, useState } from "react";
import {
  resolveRange,
  previousRange,
  computeRangeStats,
  type AnalyticsRangePreset,
  type DateRange,
} from "@/lib/analyticsRange";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import PieChart from "./PieChart";
import NoShowStatsStrip from "@/components/no-shows/NoShowStatsStrip";
import type {
  AppointmentReliability,
  AreaStat,
  ConsultConversionStats,
  NoShowStats,
  NoShowWeekPoint,
  PatientRetentionStats,
  StaffMachineStat,
} from "@/lib/analyticsPage";
import type { Appointment, Machine, Package, Patient, Visit } from "@/types";

function formatMinutes(n: number): string {
  if (n < 60) return `${n} min`;
  const hrs = Math.floor(n / 60);
  const mins = n % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
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

function TrendPill({ pct, invert = false }: { pct: number | null; invert?: boolean }) {
  if (pct === null) return null;
  // invert flips the color read for stats where "down" is the good
  // direction (No-Show Rate) — the arrow itself still points the way the
  // number actually moved, only green/red swaps.
  const up = pct >= 0;
  const good = invert ? !up : up;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
        good ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
      }`}
    >
      {up ? "↗" : "↘"} {Math.abs(pct)}%
    </span>
  );
}

function StatInline({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="text-brown-400">{label}</span>
      <span className="font-medium text-brown-900">{value}</span>
    </div>
  );
}

/** Everything about what's actually happening clinically and operationally
 * — not money: the range-scoped KPIs/appointment status/treatment volume
 * (own date-range toggle, independent of the Revenue tab's), then a
 * this-year Appointment Reliability + rolling no-show trend, then
 * all-time Most-Treated Areas / Staff & Machine Usage / Patient Retention
 * / Consult Conversion — those stay on their own natural timeframe for
 * the same reasoning the Revenue tab's Cash Flow and Package Utilization
 * do. */
export default function ProceduralAnalytics({
  visits,
  packages,
  appointments,
  patients,
  machines,
  reliability,
  staffMachineStats,
  areaStats,
  patientRetention,
  consultConversion,
  noShowStats,
  noShowTrend,
}: {
  visits: Visit[];
  packages: Package[];
  appointments: Appointment[];
  patients: Patient[];
  machines: Machine[];
  reliability: AppointmentReliability;
  staffMachineStats: StaffMachineStat[];
  areaStats: AreaStat[];
  patientRetention: PatientRetentionStats;
  consultConversion: ConsultConversionStats;
  noShowStats: NoShowStats;
  noShowTrend: NoShowWeekPoint[];
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

  const statusTotal = stats.statusCounts.completed + stats.statusCounts.cancelled + stats.statusCounts.noShow;
  const noShowRate = statusTotal > 0 ? (stats.statusCounts.noShow / statusTotal) * 100 : 0;
  const prevStatusTotal =
    prevStats.statusCounts.completed + prevStats.statusCounts.cancelled + prevStats.statusCounts.noShow;
  const prevNoShowRate = prevStatusTotal > 0 ? (prevStats.statusCounts.noShow / prevStatusTotal) * 100 : 0;

  const volumeBars = Object.entries(stats.countByType)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  const maxVolume = Math.max(...volumeBars.map(([, c]) => c), 1);

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
        <div className="rounded-2xl border border-beige-300 bg-surface p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-brown-400">No-Show Rate</span>
            <TrendPill pct={pctChange(noShowRate, prevNoShowRate)} invert />
          </div>
          <div className="mt-2 font-display text-3xl font-bold text-brown-900">{noShowRate.toFixed(0)}%</div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                { label: "Completed", value: stats.statusCounts.completed, color: "#3F7D58", sublabel: "appointments" },
                { label: "Cancelled", value: stats.statusCounts.cancelled, color: "#C1442D", sublabel: "appointments" },
                { label: "No-show", value: stats.statusCounts.noShow, color: "#9C8672", sublabel: "appointments" },
              ]}
            />
          )}
        </div>

        <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold text-brown-900">Top Treatments by Volume</h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-rust-600" />
          {volumeBars.length === 0 ? (
            <p className="text-sm text-brown-400">No sessions logged in this range.</p>
          ) : (
            <div className="space-y-4">
              {volumeBars.map(([type, count]) => (
                <div key={type}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-brown-700">{SESSION_TYPE_CONFIG[type]?.label ?? type}</span>
                    <span className="font-medium text-brown-900">
                      {count} session{count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-beige-200">
                    <div
                      className="animate-grow-x h-full rounded-full bg-rust-600"
                      style={{ width: `${(count / maxVolume) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-semibold text-brown-500">More Detail</h2>
        <div className="mt-2 mb-6 h-[2px] w-8 bg-beige-300" />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold text-brown-900">
            Appointment Reliability ({new Date().getFullYear()})
          </h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-rust-600" />
          {reliability.totalPast === 0 ? (
            <p className="text-sm text-brown-400">No completed, cancelled, or no show appointments yet this year.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="font-display text-3xl font-medium text-brown-900">
                    {reliability.noShowRate.toFixed(0)}%
                  </div>
                  <div className="text-xs text-brown-400">No show rate</div>
                </div>
                <div>
                  <div className="font-display text-3xl font-medium text-brown-900">
                    {reliability.cancellationRate.toFixed(0)}%
                  </div>
                  <div className="text-xs text-brown-400">Cancellation rate</div>
                </div>
              </div>
              <p className="mt-4 text-xs text-brown-400">
                {reliability.completed} completed · {reliability.noShow} no show · {reliability.cancelled}{" "}
                cancelled ({reliability.totalPast} total)
              </p>
            </>
          )}
        </div>

        <NoShowStatsStrip stats={noShowStats} trend={noShowTrend} hideMonthRate />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold text-brown-900">Staff &amp; Machine Usage</h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-rust-600" />
          {staffMachineStats.length === 0 ? (
            <p className="text-sm text-brown-400">
              No data yet. This fills in as visits get logged with a Machine, Performed By, and
              Duration set (added to the visit form on each patient&apos;s page). Visits logged
              before that won&apos;t retroactively show up here.
            </p>
          ) : (
            <div className="space-y-2">
              {staffMachineStats.map((stat, i) => (
                <div
                  key={i}
                  className="animate-fade-up flex flex-wrap items-center justify-between gap-2 rounded-lg border border-beige-300 px-4 py-3 text-sm"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div>
                    <div className="font-medium text-brown-900">{stat.staffName}</div>
                    <div className="text-xs text-brown-400">{stat.machineName}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-brown-900">{formatMinutes(stat.totalMinutes)}</div>
                    <div className="text-xs text-brown-400">
                      {stat.sessionCount} session{stat.sessionCount === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold text-brown-900">Most-Treated Areas</h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-rust-600" />
          {areaStats.length === 0 ? (
            <p className="text-sm text-brown-400">No visits with an Area logged yet.</p>
          ) : (
            <div className="space-y-3">
              {areaStats.map((stat, i) => {
                const maxAreaCount = Math.max(...areaStats.map((a) => a.count), 1);
                return (
                  <div key={stat.area}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-brown-700">{stat.area}</span>
                      <span className="font-medium text-brown-900">{stat.count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-beige-200">
                      <div
                        className="animate-grow-x h-full rounded-full bg-rust-600"
                        style={{ width: `${(stat.count / maxAreaCount) * 100}%`, animationDelay: `${i * 60}ms` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold text-brown-900">Patient Retention</h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-rust-600" />
          {patientRetention.treatedPatients === 0 ? (
            <p className="text-sm text-brown-400">No treated patients yet.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                <StatInline label="Treated patients" value={String(patientRetention.treatedPatients)} />
                <StatInline label="Avg visits / patient" value={patientRetention.avgVisitsPerPatient.toFixed(1)} />
              </div>
              <div className="mt-5 space-y-4">
                <div className="flex h-2.5 overflow-hidden rounded-full bg-beige-200">
                  <div
                    className="h-full bg-rust-600"
                    style={{
                      width: `${(patientRetention.activePatients / patientRetention.treatedPatients) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-beige-300"
                    style={{
                      width: `${(patientRetention.lapsedPatients / patientRetention.treatedPatients) * 100}%`,
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-brown-700">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-rust-600" />
                      Active — seen in last 60 days
                    </span>
                    <span className="font-medium text-brown-900">{patientRetention.activePatients}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-brown-700">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-beige-300" />
                      Lapsed — not seen in 60+ days
                    </span>
                    <span className="font-medium text-brown-900">{patientRetention.lapsedPatients}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold text-brown-900">Consult → Treatment Conversion</h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-rust-600" />
          {consultConversion.totalConsults === 0 ? (
            <p className="text-sm text-brown-400">No consultations logged yet.</p>
          ) : (
            <>
              <div className="font-display text-3xl font-bold text-brown-900">
                {consultConversion.conversionRate.toFixed(0)}%
              </div>
              <p className="mt-2 text-xs text-brown-400">
                {consultConversion.converted} of {consultConversion.totalConsults} consulted patients went on to
                a real treatment.
              </p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-beige-200">
                <div
                  className="animate-grow-x h-full rounded-full bg-rust-600"
                  style={{ width: `${consultConversion.conversionRate}%` }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
