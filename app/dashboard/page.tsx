import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPatients } from "@/lib/firestore/patients";
import { getClinicVisits } from "@/lib/firestore/visits";
import { getClinicPackages } from "@/lib/firestore/packages";
import { computeTodayStats, computeRecentActivity, computeMonthlyRevenue } from "@/lib/analytics";
import { SESSION_TYPE_CONFIG } from "@/lib/sessionTypes";
import StatCard from "@/components/StatCard";
import RevenueChart from "@/components/RevenueChart";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatCurrency(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [patients, visits, packages] = await Promise.all([
    getPatients(session.clinicId),
    getClinicVisits(session.clinicId),
    getClinicPackages(session.clinicId),
  ]);

  const patientsById = new Map(patients.map((p) => [p.id, p]));
  const todayStats = computeTodayStats(patients, visits, packages);
  const recentActivity = computeRecentActivity(visits, patientsById);

  // Detailed monthly revenue analytics are doctor/owner-only — reception
  // still sees the simple same-day total in the stats row above, just not
  // the breakdown/charts.
  const canSeeRevenueAnalytics = session.role === "doctor" || session.role === "owner";
  const monthlyRevenue = canSeeRevenueAnalytics ? computeMonthlyRevenue(visits, packages) : null;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-brown-900">
        {greeting()}
      </h1>
      <p className="mt-1 text-sm text-brown-600">{today}</p>
      <div className="mt-3 mb-8 h-[2px] w-8 bg-gold-500" />

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Visits Today" value={todayStats.visitsToday} />
        <StatCard label="New Patients Today" value={todayStats.newPatientsToday} />
        <StatCard label="Revenue Today" value={formatCurrency(todayStats.revenueToday)} accent />
        <StatCard label="Total Patients" value={todayStats.totalPatients} />
      </div>

      <div className="mt-8 grid grid-cols-3 gap-6">
        <div className={canSeeRevenueAnalytics ? "col-span-2" : "col-span-3"}>
          <h2 className="font-display text-lg font-medium text-brown-900">Recent Activity</h2>
          <div className="mt-2 mb-4 h-[2px] w-8 bg-gold-500" />

          {recentActivity.length === 0 ? (
            <div className="rounded-xl bg-surface p-8 text-center shadow-soft ring-1 ring-beige-300">
              <p className="text-sm text-brown-600">No visits logged yet.</p>
              <Link
                href="/dashboard/patients"
                className="mt-2 inline-block text-sm font-medium text-gold-600 hover:underline"
              >
                Go to Patients
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl bg-surface shadow-soft ring-1 ring-beige-300">
              {recentActivity.map((item, i) => {
                const cfg = SESSION_TYPE_CONFIG[item.sessionType];
                return (
                  <Link
                    key={item.visitId}
                    href={`/dashboard/patients/${item.patientId}`}
                    className={[
                      "flex items-center justify-between px-5 py-3 text-sm transition-colors hover:bg-gold-100/40",
                      i !== recentActivity.length - 1 ? "border-b border-beige-300" : "",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${cfg.badgeClassName}`}
                      >
                        {cfg.badgeText}
                      </span>
                      <span className="font-medium text-brown-900">{item.patientName}</span>
                    </span>
                    <span className="flex items-center gap-4 text-brown-600">
                      <span>{item.date || "No date"}</span>
                      {item.fee > 0 && (
                        <span className="font-medium text-brown-900">
                          {formatCurrency(item.fee)}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {canSeeRevenueAnalytics && monthlyRevenue && (
          <div>
            <h2 className="font-display text-lg font-medium text-brown-900">Analytics</h2>
            <div className="mt-2 mb-4 h-[2px] w-8 bg-gold-500" />
            <RevenueChart data={monthlyRevenue} />
          </div>
        )}
      </div>
    </div>
  );
}