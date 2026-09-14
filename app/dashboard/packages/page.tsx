import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getClinicPackageTypeDefs } from "@/lib/db/packageTypeDefs";
import { getClinicSessionTypeDefs } from "@/lib/db/sessionTypeDefs";
import { buildSessionTypeConfig } from "@/lib/sessionTypes";
import { getClinic } from "@/lib/db/clinics";
import { getPatients } from "@/lib/db/patients";
import { getClinicVisits } from "@/lib/db/visits";
import { getClinicPackages } from "@/lib/db/packages";
import { getClinicStaff } from "@/lib/db/staff";
import { getClinicConsentTemplates, getClinicConsentFormsPage } from "@/lib/db/consentForms";
import { getClinicReceiptsPage } from "@/lib/db/receipts";
import PatientManagementTabs from "@/components/patients-config/PatientManagementTabs";

export default async function PatientManagementPage({
  searchParams,
}: {
  // Set by the "Generate Receipt" pipeline shortcut on an appointment (see
  // lib/pipeline.ts and components/overview/TodayAgenda.tsx) to land
  // directly on the Receipts tab with that patient/visit pre-loaded.
  searchParams: { tab?: string; newReceiptForPatient?: string; visitId?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/api/auth/force-logout");

  const [
    packageTypeDefs,
    sessionTypeDefs,
    clinic,
    patients,
    visits,
    packages,
    staff,
    templates,
    formsPage,
    receiptsPage,
  ] = await Promise.all([
    getClinicPackageTypeDefs(session.clinicId),
    getClinicSessionTypeDefs(session.clinicId),
    getClinic(session.clinicId),
    getPatients(session.clinicId),
    getClinicVisits(session.clinicId),
    getClinicPackages(session.clinicId),
    getClinicStaff(session.clinicId),
    getClinicConsentTemplates(session.clinicId),
    getClinicConsentFormsPage(session.clinicId),
    getClinicReceiptsPage(session.clinicId),
  ]);
  const sessionTypeConfig = buildSessionTypeConfig(sessionTypeDefs);

  const currentStaff = staff.find((s) => s.uid === session.uid);
  const currentName = currentStaff?.name || session.email || "Staff";

  const initialTab =
    searchParams.tab === "receipts" ||
    searchParams.tab === "consent" ||
    searchParams.tab === "areas"
      ? searchParams.tab
      : undefined;

  return (
    <div>
      <h1 className="inline-block border-b-4 border-rust-600 pb-1 font-display text-2xl font-bold text-brown-900">
        Patient Management
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-brown-400">
        Package presets, treatment areas, consent forms, and receipts — the reusable setup and
        paperwork behind every patient record.
      </p>

      <div className="mt-8">
        <PatientManagementTabs
          packageTypeDefs={packageTypeDefs}
          sessionTypeConfig={sessionTypeConfig}
          canEditPackages={session.role === "owner"}
          canEditAreas={session.role === "owner"}
          clinicId={session.clinicId}
          clinicName={clinic?.name || "Your Clinic"}
          clinicAddress={clinic?.address}
          patients={patients}
          visits={visits}
          packages={packages}
          templates={templates}
          initialForms={formsPage.forms}
          initialFormsCursor={formsPage.nextCursor}
          initialReceipts={receiptsPage.receipts}
          initialReceiptsCursor={receiptsPage.nextCursor}
          currentUid={session.uid}
          currentName={currentName}
          canManageTemplates={session.role === "owner"}
          autoOpenReceiptPatientId={searchParams.newReceiptForPatient}
          autoAddReceiptVisitId={searchParams.visitId}
          initialTab={initialTab}
        />
      </div>
    </div>
  );
}
