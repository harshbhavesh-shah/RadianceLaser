import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getClinicVisits } from "@/lib/db/visits";
import { getClinicPackages } from "@/lib/db/packages";
import { getClinicMachines } from "@/lib/db/machines";
import { getClinicAppointments } from "@/lib/db/appointments";
import {
  computeRevenueSummary,
  computeYearlyRevenueTrend,
  computeRevenueByType,
  computeStaffMachineStats,
  computeAreaPopularity,
  computeCashFlowSummary,
  computeAppointmentReliability,
  computePackageUtilization,
} from "@/lib/analyticsPage";
import { getClinicSessionTypeDefs } from "@/lib/db/sessionTypeDefs";
import { buildSessionTypeConfig } from "@/lib/sessionTypes";
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

/** Small "label — value" pair used inline across the cards below, instead
 * of another grid of boxes. */
function StatInline({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="text-brown-400">{label}</span>
      <span className="font-medium text-brown-900">{value}</span>
    </div>
  );
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

  const [visits, packages, machines, appointments, sessionTypeDefs] = await Promise.all([
    getClinicVisits(session.clinicId),
    getClinicPackages(session.clinicId),
    getClinicMachines(session.clinicId),
    getClinicAppointments(session.clinicId),
    getClinicSessionTypeDefs(session.clinicId),
  ]);
  const SESSION_TYPE_CONFIG = buildSessionTypeConfig(sessionTypeDefs);

  const revenue = computeRevenueSummary(visits, packages);
  const yearlyTrend = computeYearlyRevenueTrend(visits, packages);
  const revenueByType = computeRevenueByType(visits, packages);
  const staffMachineStats = computeStaffMachineStats(visits, machines);
  const areaStats = computeAreaPopularity(visits);
  const maxAreaCount = Math.max(...areaStats.map((a) => a.count), 1);
  const cashFlow = computeCashFlowSummary(visits, packages);
  const reliability = computeAppointmentReliability(appointments);
  const packageUtilization = computePackageUtilization(packages, visits);

  const currentYear = new Date().getFullYear();

  const cashFlowRows = [
    { label: "Cash", amount: cashFlow.cash, colorClass: "bg-gold-500" },
    { label: "Online", amount: cashFlow.online, colorClass: "bg-brown-700" },
    ...(cashFlow.unspecified > 0
      ? [{ label: "Unspecified", amount: cashFlow.unspecified, colorClass: "bg-beige-300" }]
      : []),
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-brown-900">Analytics</h1>
      <div className="mt-2 mb-8 h-[2px] w-8 bg-gold-500" />

      {/* Revenue hero — one prominent number (this month) instead of four
          equal boxes, with the other windows as a compact row underneath. */}
      <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
        <div className="text-xs font-medium uppercase tracking-wide text-brown-400">
          This Month&apos;s Revenue
        </div>
        <div className="mt-1.5 font-display text-4xl font-medium text-gold-600">
          {formatCurrency(revenue.month.total)}
        </div>
        <div className="mt-1 text-xs text-brown-400">
          {formatCurrency(revenue.month.directRevenue)} direct ·{" "}
          {formatCurrency(revenue.month.packageRevenue)} via packages
        </div>
        <div className="mt-5 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-t border-beige-300 pt-4">
          <StatInline label="Today" value={formatCurrency(revenue.day.total)} />
          <StatInline label="This Week" value={formatCurrency(revenue.week.total)} />
          <StatInline label="This Year" value={formatCurrency(revenue.year.total)} />
        </div>
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
        {/* Cash flow — cash vs online, this year */}
        <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
          <h2 className="font-display text-lg font-medium text-brown-900">
            Cash Flow — {currentYear}
          </h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-gold-500" />

          {cashFlow.total === 0 ? (
            <p className="text-sm text-brown-400">
              No revenue logged yet this year. Payment method is set on each visit or package
              purchase — see the Payment Method field when logging a session or selling a
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

        {/* No-show / cancellation rate, this year */}
        <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
          <h2 className="font-display text-lg font-medium text-brown-900">
            Appointment Reliability — {currentYear}
          </h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-gold-500" />

          {reliability.totalPast === 0 ? (
            <p className="text-sm text-brown-400">
              No completed, cancelled, or no show appointments yet this year.
            </p>
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
                {reliability.completed} completed · {reliability.noShow} no show ·{" "}
                {reliability.cancelled} cancelled ({reliability.totalPast} total)
              </p>
            </>
          )}
        </div>
      </div>

      {/* Package utilization / breakage */}
      <div className="mt-8 rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
        <h2 className="font-display text-lg font-medium text-brown-900">Package Utilization</h2>
        <div className="mt-2 mb-5 h-[2px] w-8 bg-gold-500" />

        {packageUtilization.sessionsSold === 0 ? (
          <p className="text-sm text-brown-400">No packages sold yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <StatInline label="Packages sold" value={String(packageUtilization.packagesSold)} />
              <StatInline label="Sessions sold" value={String(packageUtilization.sessionsSold)} />
              <StatInline label="Sessions used" value={String(packageUtilization.sessionsUsed)} />
              <StatInline
                label="Lost to expiry"
                value={String(packageUtilization.sessionsLostToExpiry)}
              />
            </div>
            <div className="mt-5">
              <div className="mb-1.5 flex justify-between text-xs text-brown-400">
                <span>Utilization</span>
                <span>{packageUtilization.utilizationRate.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-beige-200">
                <div
                  className="animate-grow-x h-full rounded-full bg-gold-500"
                  style={{ width: `${packageUtilization.utilizationRate}%` }}
                />
              </div>
            </div>
            {packageUtilization.breakageRate > 0 && (
              <p className="mt-3 text-xs text-brown-400">
                {packageUtilization.breakageRate.toFixed(0)}% of sold sessions ({packageUtilization.sessionsLostToExpiry}) expired
                unused.
              </p>
            )}
          </>
        )}
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

        {/* Most-treated body areas */}
        <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
          <h2 className="font-display text-lg font-medium text-brown-900">Most-Treated Areas</h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-gold-500" />

          {areaStats.length === 0 ? (
            <p className="text-sm text-brown-400">No visits with an Area logged yet.</p>
          ) : (
            <div className="space-y-3">
              {areaStats.map((stat, i) => (
                <div key={stat.area}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-brown-700">{stat.area}</span>
                    <span className="font-medium text-brown-900">{stat.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-beige-200">
                    <div
                      className="animate-grow-x h-full rounded-full bg-gold-500"
                      style={{
                        width: `${(stat.count / maxAreaCount) * 100}%`,
                        animationDelay: `${i * 60}ms`,
                      }}
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
