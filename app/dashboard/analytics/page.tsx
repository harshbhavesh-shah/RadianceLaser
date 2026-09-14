import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getClinicVisits } from "@/lib/db/visits";
import { getClinicPackages } from "@/lib/db/packages";
import { getClinicMachines } from "@/lib/db/machines";
import { getClinicAppointments } from "@/lib/db/appointments";
import { getPatients } from "@/lib/db/patients";
import {
  computeStaffMachineStats,
  computeAreaPopularity,
  computeCashFlowSummary,
  computeAppointmentReliability,
  computePackageUtilization,
} from "@/lib/analyticsPage";
import { getClinic } from "@/lib/db/clinics";
import { getClinicTier, getEntitlements } from "@/lib/entitlements";
import AnalyticsClient from "@/components/analytics/AnalyticsClientLoader";

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
  if (!session) redirect("/api/auth/force-logout");

  const clinic = await getClinic(session.clinicId);
  const tier = getClinicTier(
    clinic ?? { subscriptionStatus: "active", trialEndsAt: 0, planTier: null }
  );
  if (!getEntitlements(tier).analytics) redirect("/dashboard");

  if (session.role !== "owner" && session.role !== "doctor") {
    return (
      <div className="rounded-2xl border border-beige-300 bg-surface p-8 text-center shadow-soft">
        <p className="text-sm text-brown-600">
          Analytics is only available to doctors and the clinic owner.
        </p>
      </div>
    );
  }

  const [visits, packages, machines, appointments, patients] = await Promise.all([
    getClinicVisits(session.clinicId),
    getClinicPackages(session.clinicId),
    getClinicMachines(session.clinicId),
    getClinicAppointments(session.clinicId),
    getPatients(session.clinicId),
  ]);

  const staffMachineStats = computeStaffMachineStats(visits, machines);
  const areaStats = computeAreaPopularity(visits);
  const maxAreaCount = Math.max(...areaStats.map((a) => a.count), 1);
  const cashFlow = computeCashFlowSummary(visits, packages);
  const reliability = computeAppointmentReliability(appointments);
  const packageUtilization = computePackageUtilization(packages, visits);

  const currentYear = new Date().getFullYear();

  const cashFlowRows = [
    { label: "Cash", amount: cashFlow.cash, colorClass: "bg-rust-600" },
    { label: "Online", amount: cashFlow.online, colorClass: "bg-brown-700" },
    ...(cashFlow.unspecified > 0
      ? [{ label: "Unspecified", amount: cashFlow.unspecified, colorClass: "bg-beige-300" }]
      : []),
  ];

  return (
    <div>
      {/* The date-range-driven half — Total Revenue/Appointments/New
          Patients, the revenue line, Top Treatments, and Appointment
          Status all recompute together as the toggle changes (see
          lib/analyticsRange.ts). Raw data is fetched once here, server
          side, and handed down — no refetch per toggle click. */}
      <AnalyticsClient visits={visits} packages={packages} appointments={appointments} patients={patients} />

      {/* Whole-year / all-time detail the toggle above doesn't touch —
          package breakage and staff/machine usage are genuinely not
          "this week" questions, so these stay on their own natural
          timeframe rather than being forced into the toggle. */}
      <div className="mt-12">
        <h2 className="font-display text-lg font-semibold text-brown-500">More Detail ({currentYear})</h2>
        <div className="mt-2 mb-6 h-[2px] w-8 bg-beige-300" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Cash flow — cash vs online, this year */}
        <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold text-brown-900">
            Cash Flow ({currentYear})
          </h2>
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

        {/* No-show / cancellation rate, this year */}
        <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold text-brown-900">
            Appointment Reliability ({currentYear})
          </h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-rust-600" />

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
      <div className="mt-8 rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold text-brown-900">Package Utilization</h2>
        <div className="mt-2 mb-5 h-[2px] w-8 bg-rust-600" />

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
                  className="animate-grow-x h-full rounded-full bg-rust-600"
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

        {/* Most-treated body areas */}
        <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold text-brown-900">Most-Treated Areas</h2>
          <div className="mt-2 mb-5 h-[2px] w-8 bg-rust-600" />

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
                      className="animate-grow-x h-full rounded-full bg-rust-600"
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
