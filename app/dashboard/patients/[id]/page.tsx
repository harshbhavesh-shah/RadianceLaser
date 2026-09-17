import Link from "next/link";
import { Hash, Phone, SquarePen, User } from "lucide-react";
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

  const initials = patient.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <Link href="/dashboard/patients" className="text-sm text-brown-600 hover:text-rust-700">
        ← Back to Patients
      </Link>

      <header className="flex flex-col gap-6 rounded-[18px] border border-beige-300 bg-surface p-6 shadow-soft md:flex-row md:items-center md:justify-between md:p-8">
        <div className="flex items-center gap-6">
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full border-4 border-white bg-beige-200 text-2xl font-extrabold text-brown-400 shadow-sm">
            {initials}
          </div>
          <div>
            <h1 className="m-0 text-3xl font-extrabold tracking-tight text-brown-900">{patient.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm font-semibold text-brown-400">
              <span className="flex items-center gap-1.5">
                <Hash size={14} />
                {patient.patientCode}
              </span>
              {patient.age !== undefined && (
                <span className="flex items-center gap-1.5">
                  <User size={14} />
                  {patient.age} yrs
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Phone size={14} />
                {patient.phone}
              </span>
            </div>
          </div>
        </div>

        <Link
          href={`/dashboard/patients/${patient.id}/edit`}
          className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-beige-300 px-4 py-2.5 text-sm font-bold text-brown-900 transition-colors hover:border-brown-900/20 hover:bg-beige-200/50"
        >
          <SquarePen size={16} strokeWidth={2.5} />
          Edit
        </Link>
      </header>

      <div className="rounded-[18px] border border-beige-300 bg-surface p-6 shadow-soft">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <InfoField label="Email" value={patient.email || "—"} />
          <InfoField label="Gender" value={patient.gender || "—"} />
          <InfoField label="Skin Type" value={patient.skinType ? `Type ${patient.skinType}` : "—"} />
          <InfoField label="Address" value={patient.address || "—"} />
        </div>

        {patient.contraindications && (
          <div className="mt-6 rounded-[14px] border border-rust-600/30 bg-rust-100/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-rust-700">
              Contraindications / Notes
            </div>
            <p className="mt-1 text-sm text-brown-700">{patient.contraindications}</p>
          </div>
        )}
      </div>

      <div>
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
