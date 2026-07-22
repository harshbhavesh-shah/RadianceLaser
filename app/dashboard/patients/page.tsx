import Link from "next/link";
import { getSession } from "@/lib/session";
import { getPatients } from "@/lib/firestore/patients";
import { redirect } from "next/navigation";
import PatientsTable from "@/components/patients/PatientsTable";

export default async function PatientsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const patients = await getPatients(session.clinicId);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
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

      <PatientsTable patients={patients} />
    </div>
  );
}
