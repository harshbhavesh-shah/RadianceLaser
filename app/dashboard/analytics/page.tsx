import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getClinicVisits } from "@/lib/firestore/visits";
import { getClinicPackages } from "@/lib/firestore/packages";
import { getClinicMachines } from "@/lib/firestore/machines";
import {
  computeRevenueSummary,
  computeYearlyRevenueTrend,
  computeRevenueByType,
  computeStaffMachineStats,
  computeAreaPopularity,
} from "@/lib/analyticsPage";
import { getClinicSessionTypeDefs } from "@/lib/firestore/sessionTypeDefs";
import { buildSessionTypeConfig } from "@/lib/sessionTypes";
import StatCard from "@/components/StatCard";
import PieChart from "@/components/analytics/PieChart";
import YearlyRevenueChart from "@/components/analytics/YearlyRevenueChart";

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function formatMinutes(n: number): string {
  if (n < 60) return `${n} min`;
  const hrs = Math.floor(n / 60);
  const mins = n % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role !== "owner" && session.role !== "doctor") {
    return (
      <div className="rounded-xl bg-surface p-8 text-center shadow-soft ring-1 ring-beige-300">
        <p className="text-sm text-brown-600">
          Analytics is only available to doctors and the clinic owner.
        </p>
      </div>
    );
  }

  const [visits, packages, machines, sessionTypeDefs] = await Promise.all([
    getClinicVisits(session.clinicId),
    getClinicPackages(session.clinicId),
    getClinicMachines(session.clinicId),
    getClinicSessionTypeDefs(session.clinicId),
  ]);
  const SESSION_TYPE_CONFIG = buildSessionTypeConfig(sessionTypeDefs);

  const revenue = computeRevenueSummary(visits, packages);
  const yearlyTrend = computeYearlyRevenueTrend(visits, packages);
  const revenueByType = computeRevenueByType(visits, packages);
  const staffMachineStats = computeStaffMachineStats(visits, machines);
  const areaStats = computeAreaPopularity(visits);
  const maxAreaCount = Math.max(...areaStats.map((a) => a.count), 1);

  const currentYear = new Date().getFullYear();

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-brown-900">Analytics</h1>
      <div className="mt-2 mb-8 h-[2px] w-8 bg-gold-500" />

      {/* Revenue summary — day/week/month/year */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <RevenueSummaryCard label="Today" entry={revenue.day} />
        <RevenueSummaryCard label="This Week" entry={revenue.week} />
        <RevenueSummaryCard label="This Month" entry={revenue.month} />
        <RevenueSummaryCard label="This Year" entry={revenue.year} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Yearly trend chart */}
        <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300 lg:col-span-2">
          <h2 className="font-display text-lg font-medium text-brown-900">
            Revenue Trend — {currentYear}
          </h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-gold-500" />
          <YearlyRevenueChart data={yearlyTrend} />
        </div>

        {/* Revenue by treatment type — pie chart */}
        <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
          <h2 className="font-display text-lg font-medium text-brown-900">By Treatment Type</h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-gold-500" />
          <PieChart
            segments={Object.keys(SESSION_TYPE_CONFIG).map((type) => ({
              label: SESSION_TYPE_CONFIG[type].label,
              value: revenueByType[type] || 0,
              color: SESSION_TYPE_CONFIG[type].chartColor,
            }))}
          />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Staff / machine / time breakdown */}
        <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
          <h2 className="font-display text-lg font-medium text-brown-900">Staff &amp; Machine Usage</h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-gold-500" />

          {staffMachineStats.length === 0 ? (
            <p className="text-sm text-brown-400">
              No data yet — this fills in as visits get logged with a Machine, Performed By, and
              Duration set (added to the visit form on each patient&apos;s page). Visits logged
              before that won&apos;t retroactively show up here.
            </p>
          ) : (
            <div className="space-y-2">
              {staffMachineStats.map((stat, i) => (
                <div
                  key={i}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-beige-300 px-4 py-3 text-sm"
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

        {/* Most-treated body areas */}
        <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
          <h2 className="font-display text-lg font-medium text-brown-900">Most-Treated Areas</h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-gold-500" />

          {areaStats.length === 0 ? (
            <p className="text-sm text-brown-400">No visits with an Area logged yet.</p>
          ) : (
            <div className="space-y-3">
              {areaStats.map((stat) => (
                <div key={stat.area}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-brown-700">{stat.area}</span>
                    <span className="font-medium text-brown-900">{stat.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-beige-200">
                    <div
                      className="h-full rounded-full bg-gold-500"
                      style={{ width: `${(stat.count / maxAreaCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RevenueSummaryCard({
  label,
  entry,
}: {
  label: string;
  entry: { total: number; packageRevenue: number; directRevenue: number };
}) {
  return (
    <div className="rounded-xl bg-surface p-5 shadow-soft ring-1 ring-beige-300">
      <div className="text-xs font-medium uppercase tracking-wide text-brown-400">{label}</div>
      <div className="mt-1.5 font-display text-2xl font-medium text-gold-600">
        {formatCurrency(entry.total)}
      </div>
      <div className="mt-2 text-[11px] text-brown-400">
        {formatCurrency(entry.directRevenue)} direct · {formatCurrency(entry.packageRevenue)} via
        packages
      </div>
    </div>
  );
}
