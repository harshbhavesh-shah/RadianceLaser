import Link from "next/link";
import { getSession } from "@/lib/session";
import { getPatients } from "@/lib/firestore/patients";
import { redirect } from "next/navigation";

export default async function PatientsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const patients = await getPatients(session.clinicId);

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium text-brown-900">Patients</h1>
          <div className="mt-2 h-[2px] w-8 bg-gold-500" />
        </div>
        <Link
          href="/dashboard/patients/new"
          className="rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
        >
          + New Patient
        </Link>
      </div>

      {patients.length === 0 ? (
        <div className="rounded-xl bg-surface p-10 text-center shadow-soft ring-1 ring-beige-300">
          <p className="text-sm text-brown-600">No patients yet.</p>
          <Link
            href="/dashboard/patients/new"
            className="mt-3 inline-block text-sm font-medium text-gold-600 hover:underline"
          >
            Add your first patient
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-surface shadow-soft ring-1 ring-beige-300">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-beige-300 bg-beige-200/50 text-xs uppercase tracking-wide text-brown-600">
                <th className="px-5 py-3 font-medium">Patient</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Skin Type</th>
                <th className="px-5 py-3 font-medium">Patient ID</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr
                  key={patient.id}
                  className="border-b border-beige-300 last:border-0 hover:bg-gold-100/40"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/dashboard/patients/${patient.id}`}
                      className="font-medium text-brown-900 hover:text-gold-600"
                    >
                      {patient.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-brown-600">{patient.phone}</td>
                  <td className="px-5 py-3 text-brown-600">
                    {patient.skinType ? `Type ${patient.skinType}` : "—"}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-brown-600">
                    {patient.patientCode}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
