import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPatient } from "@/lib/firestore/patients";
import { getPatientVisits } from "@/lib/firestore/visits";
import PatientVisitTabs from "@/components/PatientVisitTabs";

export default async function PatientDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const patient = await getPatient(session.clinicId, params.id);
  if (!patient) notFound();

  const visits = await getPatientVisits(session.clinicId, patient.id);

  return (
    <div className="max-w-5xl">
      <Link href="/dashboard/patients" className="text-sm text-brown-600 hover:text-gold-600">
        ← Back to Patients
      </Link>

      <div className="mt-3 mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-brown-900">{patient.name}</h1>
          <div className="mt-2 h-[2px] w-8 bg-gold-500" />
        </div>
        <span className="rounded-full bg-beige-200 px-3 py-1 font-mono text-xs text-brown-600">
          {patient.patientCode}
        </span>
      </div>

      <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
        <div className="grid grid-cols-3 gap-6">
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
        <PatientVisitTabs clinicId={session.clinicId} patientId={patient.id} visits={visits} />
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
