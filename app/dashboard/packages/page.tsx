import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPatients } from "@/lib/firestore/patients";
import { getClinicPackages } from "@/lib/firestore/packages";
import { getClinicVisits } from "@/lib/firestore/visits";
import { computePackageLedger } from "@/lib/packages";
import { getClinicSessionTypeDefs } from "@/lib/firestore/sessionTypeDefs";
import { buildSessionTypeConfig } from "@/lib/sessionTypes";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-gold-100 text-gold-600",
  completed: "bg-beige-300 text-brown-600",
  expired: "bg-red-50 text-red-700",
};

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default async function PackagesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [packages, visits, patients, sessionTypeDefs] = await Promise.all([
    getClinicPackages(session.clinicId),
    getClinicVisits(session.clinicId),
    getPatients(session.clinicId),
    getClinicSessionTypeDefs(session.clinicId),
  ]);
  const SESSION_TYPE_CONFIG = buildSessionTypeConfig(sessionTypeDefs);

  const patientsById = new Map(patients.map((p) => [p.id, p]));

  const rows = packages
    .map((pkg) => ({
      pkg,
      patientName: patientsById.get(pkg.patientId)?.name || "Unknown patient",
      ledger: computePackageLedger(
        pkg,
        visits.filter((v) => v.patientId === pkg.patientId)
      ),
    }))
    .sort((a, b) => b.pkg.createdAt - a.pkg.createdAt);

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-brown-900">Packages</h1>
      <div className="mt-2 mb-8 h-[2px] w-8 bg-gold-500" />

      {rows.length === 0 ? (
        <div className="rounded-xl bg-surface p-10 text-center shadow-soft ring-1 ring-beige-300">
          <p className="text-sm text-brown-600">No packages purchased yet.</p>
          <p className="mt-1 text-sm text-brown-400">
            Packages are created from a patient&apos;s Visit History tab — find the patient first.
          </p>
          <Link href="/dashboard/patients" className="mt-3 inline-block text-sm font-medium text-gold-600 hover:underline">
            Go to Patients →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-surface shadow-soft ring-1 ring-beige-300">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b border-beige-300 bg-beige-200/50 text-xs uppercase tracking-wide text-brown-600">
                <th className="px-5 py-3 font-medium">Patient</th>
                <th className="px-5 py-3 font-medium">Package</th>
                <th className="px-5 py-3 font-medium">Sessions</th>
                <th className="px-5 py-3 font-medium">Remaining</th>
                <th className="px-5 py-3 font-medium">Purchased</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ pkg, patientName, ledger }) => {
                const cfg = SESSION_TYPE_CONFIG[pkg.sessionType];
                return (
                  <tr
                    key={pkg.id}
                    className="border-b border-beige-300 last:border-0 hover:bg-gold-100/40"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/patients/${pkg.patientId}`}
                        className="font-medium text-brown-900 hover:text-gold-600"
                      >
                        {patientName}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${cfg.badgeClassName}`}
                        >
                          {cfg.badgeText}
                        </span>
                        <span className="text-brown-700">{pkg.label}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-brown-600">
                      {ledger.sessionsUsed} / {pkg.totalSessions}
                    </td>
                    <td className="px-5 py-3 text-brown-600">
                      {ledger.sessionsRemaining} sessions · {formatCurrency(ledger.amountRemaining)}
                    </td>
                    <td className="px-5 py-3 text-brown-600">{pkg.purchaseDate}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[ledger.status]}`}
                      >
                        {ledger.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
