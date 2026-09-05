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
    <div className="rounded-xl bg-surface p-5 shadow-soft ring-1 ring-beige-300">
      <p className="text-xs font-semibold uppercase tracking-wide text-brown-400">{label}</p>
      <p className="mt-2 font-display text-2xl font-medium text-brown-900">{value}</p>
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
      <h1 className="font-display text-2xl font-medium text-brown-900">Analytics</h1>
      <p className="mt-1 text-sm text-brown-400">How the software business itself is doing — signups and subscription revenue across every clinic.</p>
      <div className="mt-2 mb-6 h-[2px] w-8 bg-gold-500" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Clinics" value={String(clinics.length)} />
        <StatCard label="Paying" value={String(statusBreakdown.active)} />
        <StatCard label="Trialing" value={String(statusBreakdown.trialing)} />
        <StatCard label="All-Time Revenue" value={formatCurrency(totalRevenue)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
            <h2 className="font-display text-base font-medium text-brown-900">Revenue Collected — {currentYear}</h2>
            <p className="mt-0.5 text-xs text-brown-400">Successful Razorpay payments, by the month they were paid.</p>
            <div className="mt-5">
              <AdminBarChart data={revenueTrend} color="#8C6A24" formatValue={formatCurrency} />
            </div>
          </div>

          <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
            <h2 className="font-display text-base font-medium text-brown-900">New Clinics — {currentYear}</h2>
            <p className="mt-0.5 text-xs text-brown-400">Clinic signups by the month they were created.</p>
            <div className="mt-5">
              <AdminBarChart data={signupTrend} color="#2C1D14" formatValue={(n) => `${n} clinic${n === 1 ? "" : "s"}`} />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
          <h2 className="font-display text-base font-medium text-brown-900">Clinic Status</h2>
          <p className="mt-0.5 text-xs text-brown-400">Every clinic on the platform right now.</p>
          <div className="mt-5">
            <AdminDonutChart
              segments={[
                { label: "Paying", value: statusBreakdown.active, color: "#8C6A24" },
                { label: "Trialing", value: statusBreakdown.trialing, color: "#C79A3E" },
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
