import { getAllClinics } from "@/lib/db/clinics";
import { getAllPaidPayments } from "@/lib/db/payments";
import {
  computeClinicStatusBreakdown,
  computeSignupTrend,
  computeRevenueTrend,
  computeTotalRevenue,
} from "@/lib/platformAnalytics";
import AdminBarChart from "@/components/admin/AdminBarChart";
import AdminDonutChart from "@/components/admin/AdminDonutChart";

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-beige-300 bg-surface p-5 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-brown-400">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold text-brown-900">{value}</p>
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  const [clinics, payments] = await Promise.all([getAllClinics(), getAllPaidPayments()]);

  const statusBreakdown = computeClinicStatusBreakdown(clinics);
  const signupTrend = computeSignupTrend(clinics);
  const revenueTrend = computeRevenueTrend(payments);
  const totalRevenue = computeTotalRevenue(payments);
  const currentYear = new Date().getFullYear();

  return (
    <div>
      <h1 className="inline-block border-b-4 border-rust-600 pb-1 font-display text-2xl font-bold text-brown-900">
        Analytics
      </h1>
      <p className="mt-3 text-sm text-brown-400">How the software business itself is doing: signups and subscription revenue across every clinic.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Clinics" value={String(clinics.length)} />
        <StatCard label="Paying" value={String(statusBreakdown.active)} />
        <StatCard label="Trialing" value={String(statusBreakdown.trialing)} />
        <StatCard label="All-Time Revenue" value={formatCurrency(totalRevenue)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
            <h2 className="font-display text-base font-semibold text-brown-900">Revenue Collected ({currentYear})</h2>
            <p className="mt-0.5 text-xs text-brown-400">Successful Razorpay payments, by the month they were paid.</p>
            <div className="mt-5">
              <AdminBarChart data={revenueTrend} color="#C1442D" formatValue={formatCurrency} />
            </div>
          </div>

          <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
            <h2 className="font-display text-base font-semibold text-brown-900">New Clinics ({currentYear})</h2>
            <p className="mt-0.5 text-xs text-brown-400">Clinic signups by the month they were created.</p>
            <div className="mt-5">
              <AdminBarChart data={signupTrend} color="#4A342A" formatValue={(n) => `${n} clinic${n === 1 ? "" : "s"}`} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
          <h2 className="font-display text-base font-semibold text-brown-900">Clinic Status</h2>
          <p className="mt-0.5 text-xs text-brown-400">Every clinic on the platform right now.</p>
          <div className="mt-5">
            <AdminDonutChart
              segments={[
                { label: "Paying", value: statusBreakdown.active, color: "#3F7D58" },
                { label: "Trialing", value: statusBreakdown.trialing, color: "#C1442D" },
                { label: "Locked", value: statusBreakdown.locked, color: "#9C8672" },
              ]}
              formatValue={(n) => `${n}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
