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
  computePatientRetentionStats,
  computeConsultConversionStats,
  computeNoShowStats,
  computeNoShowTrend,
} from "@/lib/analyticsPage";
import { getClinic } from "@/lib/db/clinics";
import { getClinicTier, getEntitlements } from "@/lib/entitlements";
import AnalyticsTabs from "@/components/analytics/AnalyticsTabsLoader";

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

  // Everything below is either "this year" or all-time by design (not
  // driven by the tabs' own date-range toggles) — see each function's own
  // comment for why; computed once here, server side, and handed down.
  const staffMachineStats = computeStaffMachineStats(visits, machines);
  const areaStats = computeAreaPopularity(visits);
  const cashFlow = computeCashFlowSummary(visits, packages);
  const reliability = computeAppointmentReliability(appointments);
  const packageUtilization = computePackageUtilization(packages, visits);
  const patientRetention = computePatientRetentionStats(visits);
  const consultConversion = computeConsultConversionStats(visits);
  const noShowStats = computeNoShowStats(appointments);
  const noShowTrend = computeNoShowTrend(appointments);

  return (
    <AnalyticsTabs
      visits={visits}
      packages={packages}
      appointments={appointments}
      patients={patients}
      machines={machines}
      cashFlow={cashFlow}
      packageUtilization={packageUtilization}
      reliability={reliability}
      staffMachineStats={staffMachineStats}
      areaStats={areaStats}
      patientRetention={patientRetention}
      consultConversion={consultConversion}
      noShowStats={noShowStats}
      noShowTrend={noShowTrend}
    />
  );
}
