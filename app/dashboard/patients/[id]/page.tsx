import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPatient } from "@/lib/firestore/patients";
import { getPatientVisits } from "@/lib/firestore/visits";
import { getPatientPackages } from "@/lib/firestore/packages";
import { getClinicMachines } from "@/lib/firestore/machines";
import { getClinicStaff } from "@/lib/firestore/staff";
import { getPatientPhotos } from "@/lib/firestore/patientPhotos";
import { getClinic } from "@/lib/firestore/clinics";
import { getClinicConsentTemplates, getPatientConsentForms } from "@/lib/firestore/consentForms";
import { getPatientReceipts } from "@/lib/firestore/receipts";
import PatientVisitTabs from "@/components/PatientVisitTabs";
import PatientPhotoGallery from "@/components/PatientPhotoGallery";
import PatientConsentForms from "@/components/PatientConsentForms";
import PatientReceipts from "@/components/PatientReceipts";

export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  // Set by "Log Visit" links on an appointment (see
  // components/overview/TodayAgenda.tsx and
  // components/appointments/AppointmentListView.tsx) to deep-link straight
  // into the right session-type tab with the visit form already open.
  searchParams: { logVisit?: string; sessionType?: string; appointmentId?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const patient = await getPatient(session.clinicId, params.id);
  if (!patient) notFound();

  const [visits, packages, machines, staff, photos, clinic, consentTemplates, consentForms, receipts] =
    await Promise.all([
      getPatientVisits(session.clinicId, patient.id),
      getPatientPackages(session.clinicId, patient.id),
      getClinicMachines(session.clinicId),
      getClinicStaff(session.clinicId),
      getPatientPhotos(session.clinicId, patient.id),
      getClinic(session.clinicId),
      getClinicConsentTemplates(session.clinicId),
      getPatientConsentForms(session.clinicId, patient.id),
      getPatientReceipts(session.clinicId, patient.id),
    ]);

  const currentStaff = staff.find((s) => s.uid === session.uid);
  const currentName = currentStaff?.name || session.email || "Staff";

  return (
    <div className="max-w-5xl">
      <Link href="/dashboard/patients" className="text-sm text-brown-600 hover:text-gold-600">
        ← Back to Patients
      </Link>

      <div className="mt-3 mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-brown-900">{patient.name}</h1>
          <div className="mt-2 h-[2px] w-8 bg-gold-500" />
        </div>
        <span className="rounded-full bg-beige-200 px-3 py-1 font-mono text-xs text-brown-600">
          {patient.patientCode}
        </span>
      </div>

      <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <InfoField label="Contact" value={patient.phone} />
          <InfoField label="Email" value={patient.email || "—"} />
          <InfoField label="Age" value={patient.age?.toString() || "—"} />
          <InfoField label="Gender" value={patient.gender || "—"} />
          <InfoField label="Skin Type" value={patient.skinType ? `Type ${patient.skinType}` : "—"} />
          <InfoField label="Address" value={patient.address || "—"} />
        </div>

        {patient.contraindications && (
          <div className="mt-6 rounded-lg border border-gold-500/40 bg-gold-100/50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gold-600">
              Contraindications / Notes
            </div>
            <p className="mt-1 text-sm text-brown-700">{patient.contraindications}</p>
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-medium text-brown-900">Visit History</h2>
        <div className="mt-2 mb-4 h-[2px] w-8 bg-gold-500" />
        <PatientVisitTabs
          clinicId={session.clinicId}
          patientId={patient.id}
          visits={visits}
          packages={packages}
          machines={machines}
          staff={staff}
          initialActiveTab={searchParams.logVisit === "1" ? searchParams.sessionType : undefined}
          autoOpenVisitForAppointmentId={searchParams.logVisit === "1" ? searchParams.appointmentId : undefined}
        />
      </div>

      {/* Photos, consent forms, and receipts are all secondary records that
          reference the clinical history above — kept below it rather than
          competing with it for the first thing you see on the page. */}
      <div className="mt-10">
        <PatientPhotoGallery
          clinicId={session.clinicId}
          patientId={patient.id}
          visits={visits}
          initialPhotos={photos}
          currentUid={session.uid}
          currentName={currentName}
        />
      </div>

      <div className="mt-8">
        <PatientConsentForms
          clinicId={session.clinicId}
          patientId={patient.id}
          patientName={patient.name}
          clinicName={clinic?.name || "Your Clinic"}
          templates={consentTemplates}
          visits={visits}
          initialForms={consentForms}
          currentUid={session.uid}
          currentName={currentName}
        />
      </div>

      <div className="mt-8">
        <PatientReceipts
          clinicId={session.clinicId}
          clinicName={clinic?.name || "Your Clinic"}
          clinicAddress={clinic?.address}
          patient={patient}
          visits={visits}
          packages={packages}
          initialReceipts={receipts}
          currentUid={session.uid}
          currentName={currentName}
        />
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-brown-400">{label}</div>
      <div className="mt-1 text-sm text-brown-900">{value}</div>
    </div>
  );
}
