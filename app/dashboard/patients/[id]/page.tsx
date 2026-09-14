import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPatient } from "@/lib/db/patients";
import { getPatientVisits } from "@/lib/db/visits";
import { getPatientPackages } from "@/lib/db/packages";
import { getClinicPackageTypeDefs } from "@/lib/db/packageTypeDefs";
import { getClinicMachines } from "@/lib/db/machines";
import { getClinicStaff } from "@/lib/db/staff";
import { getPatientPhotos } from "@/lib/db/patientPhotos";
import { getClinic } from "@/lib/db/clinics";
import { getClinicConsentTemplates, getPatientConsentForms } from "@/lib/db/consentForms";
import { getPatientReceipts } from "@/lib/db/receipts";
import PatientRecordTabs from "@/components/PatientRecordTabs";

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
  if (!session) redirect("/api/auth/force-logout");

  const patient = await getPatient(session.clinicId, params.id);
  if (!patient) notFound();

  const [visits, packages, packageTypeDefs, machines, staff, photos, clinic, consentTemplates, consentForms, receipts] =
    await Promise.all([
      getPatientVisits(session.clinicId, patient.id),
      getPatientPackages(session.clinicId, patient.id),
      getClinicPackageTypeDefs(session.clinicId),
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
      <Link href="/dashboard/patients" className="text-sm text-brown-600 hover:text-rust-700">
        ← Back to Patients
      </Link>

      <div className="mt-3 mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-rust-100 font-display text-lg font-bold text-rust-700">
            {patient.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-brown-900">{patient.name}</h1>
            <span className="mt-1 inline-block rounded-full bg-beige-200 px-3 py-1 font-mono text-xs text-brown-600">
              {patient.patientCode}
            </span>
          </div>
        </div>
        <Link
          href={`/dashboard/patients/${patient.id}/edit`}
          className="rounded-lg border border-beige-300 bg-surface px-3 py-1.5 text-xs font-semibold text-brown-700 transition-colors hover:border-rust-600 hover:text-rust-700"
        >
          Edit
        </Link>
      </div>

      <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <InfoField label="Contact" value={patient.phone} />
          <InfoField label="Email" value={patient.email || "—"} />
          <InfoField label="Age" value={patient.age?.toString() || "—"} />
          <InfoField label="Gender" value={patient.gender || "—"} />
          <InfoField label="Skin Type" value={patient.skinType ? `Type ${patient.skinType}` : "—"} />
          <InfoField label="Address" value={patient.address || "—"} />
        </div>

        {patient.contraindications && (
          <div className="mt-6 rounded-lg border border-rust-600/30 bg-rust-100/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-rust-700">
              Contraindications / Notes
            </div>
            <p className="mt-1 text-sm text-brown-700">{patient.contraindications}</p>
          </div>
        )}
      </div>

      <div className="mt-8">
        <PatientRecordTabs
          visitTabs={{
            clinicId: session.clinicId,
            patientId: patient.id,
            visits,
            packages,
            packageTypeDefs,
            machines,
            staff,
            initialActiveTab: searchParams.logVisit === "1" ? searchParams.sessionType : undefined,
            autoOpenVisitForAppointmentId:
              searchParams.logVisit === "1" ? searchParams.appointmentId : undefined,
          }}
          photoGallery={{
            clinicId: session.clinicId,
            patientId: patient.id,
            visits,
            initialPhotos: photos,
            currentUid: session.uid,
            currentName,
          }}
          consentForms={{
            clinicId: session.clinicId,
            patientId: patient.id,
            patientName: patient.name,
            clinicName: clinic?.name || "Your Clinic",
            templates: consentTemplates,
            visits,
            initialForms: consentForms,
            currentUid: session.uid,
            currentName,
          }}
          receipts={{
            clinicId: session.clinicId,
            clinicName: clinic?.name || "Your Clinic",
            clinicAddress: clinic?.address,
            patient,
            visits,
            packages,
            initialReceipts: receipts,
            currentUid: session.uid,
            currentName,
          }}
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
