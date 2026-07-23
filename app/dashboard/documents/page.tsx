import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getClinic } from "@/lib/firestore/clinics";
import { getPatients } from "@/lib/firestore/patients";
import { getClinicVisits } from "@/lib/firestore/visits";
import { getClinicPackages } from "@/lib/firestore/packages";
import { getClinicStaff } from "@/lib/firestore/staff";
import { getClinicConsentTemplates, getClinicConsentForms } from "@/lib/firestore/consentForms";
import { getClinicReceipts } from "@/lib/firestore/receipts";
import DocumentsTabs from "@/components/documents/DocumentsTabs";

export default async function DocumentsPage({
  searchParams,
}: {
  // Set by the "Generate Receipt" pipeline shortcut on an appointment (see
  // lib/pipeline.ts and components/overview/TodayAgenda.tsx) to land
  // directly on the Receipts tab with that patient/visit pre-loaded.
  searchParams: { tab?: string; newReceiptForPatient?: string; visitId?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [clinic, patients, visits, packages, staff, templates, forms, receipts] = await Promise.all([
    getClinic(session.clinicId),
    getPatients(session.clinicId),
    getClinicVisits(session.clinicId),
    getClinicPackages(session.clinicId),
    getClinicStaff(session.clinicId),
    getClinicConsentTemplates(session.clinicId),
    getClinicConsentForms(session.clinicId),
    getClinicReceipts(session.clinicId),
  ]);

  const currentStaff = staff.find((s) => s.uid === session.uid);
  const currentName = currentStaff?.name || session.email || "Staff";

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-medium text-brown-900">Documents</h1>
      <p className="mt-2 text-sm text-brown-400">Consent forms and patient receipts, in one place.</p>
      <div className="mt-2 mb-8 h-[2px] w-8 bg-gold-500" />

      <DocumentsTabs
        clinicId={session.clinicId}
        clinicName={clinic?.name || "Your Clinic"}
        clinicAddress={clinic?.address}
        patients={patients}
        visits={visits}
        packages={packages}
        templates={templates}
        initialForms={forms}
        initialReceipts={receipts}
        currentUid={session.uid}
        currentName={currentName}
        canManageTemplates={session.role === "owner"}
        initialTab={searchParams.tab === "receipts" ? "receipts" : undefined}
        autoOpenReceiptPatientId={searchParams.newReceiptForPatient}
        autoAddReceiptVisitId={searchParams.visitId}
      />
    </div>
  );
}
