"use client";

import { useState } from "react";
import RevenueAnalytics from "./RevenueAnalytics";
import ProceduralAnalytics from "./ProceduralAnalytics";
import type { Appointment, Machine, Package, Patient, Visit } from "@/types";
import type {
  AppointmentReliability,
  AreaStat,
  CashFlowSummary,
  ConsultConversionStats,
  NoShowStats,
  NoShowWeekPoint,
  PackageUtilizationSummary,
  PatientRetentionStats,
  StaffMachineStat,
} from "@/lib/analyticsPage";

type Tab = "revenue" | "procedural";

const TABS: { key: Tab; label: string }[] = [
  { key: "revenue", label: "Revenue" },
  { key: "procedural", label: "Procedural" },
];

/** Analytics used to be one long page mixing money and treatment/operations
 * questions together — split into two tabs (same pattern as Communication
 * and Patient Management) so "how much did we make" and "what are we
 * actually doing" each get their own focused read, with their own
 * independent date-range toggle. Raw data is fetched once, server side,
 * in app/dashboard/analytics/page.tsx and handed down here; each tab
 * recomputes its own range-scoped stats client side as its own toggle
 * changes (see lib/analyticsRange.ts), with no refetch either way. */
export default function AnalyticsTabs({
  visits,
  packages,
  appointments,
  patients,
  machines,
  cashFlow,
  packageUtilization,
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
  cashFlow: CashFlowSummary;
  packageUtilization: PackageUtilizationSummary;
  reliability: AppointmentReliability;
  staffMachineStats: StaffMachineStat[];
  areaStats: AreaStat[];
  patientRetention: PatientRetentionStats;
  consultConversion: ConsultConversionStats;
  noShowStats: NoShowStats;
  noShowTrend: NoShowWeekPoint[];
}) {
  const [tab, setTab] = useState<Tab>("revenue");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 text-3xl font-extrabold tracking-tight text-brown-900">Analytics</h1>
        <div className="flex items-center gap-1 rounded-xl border border-beige-300 bg-surface p-1 shadow-soft">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key ? "bg-rust-100 text-rust-700" : "text-brown-600 hover:text-brown-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {tab === "revenue" ? (
          <RevenueAnalytics
            visits={visits}
            packages={packages}
            appointments={appointments}
            patients={patients}
            cashFlow={cashFlow}
            packageUtilization={packageUtilization}
          />
        ) : (
          <ProceduralAnalytics
            visits={visits}
            packages={packages}
            appointments={appointments}
            patients={patients}
            machines={machines}
            reliability={reliability}
            staffMachineStats={staffMachineStats}
            areaStats={areaStats}
            patientRetention={patientRetention}
            consultConversion={consultConversion}
            noShowStats={noShowStats}
            noShowTrend={noShowTrend}
          />
        )}
      </div>
    </div>
  );
}
