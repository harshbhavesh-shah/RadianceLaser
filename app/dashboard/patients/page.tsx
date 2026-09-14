import Link from "next/link";
import { getSession } from "@/lib/session";
import { getPatientsPage } from "@/lib/db/patients";
import { redirect } from "next/navigation";
import PatientsTable from "@/components/patients/PatientsTable";

export default async function PatientsPage() {
  const session = await getSession();
  if (!session) redirect("/api/auth/force-logout");

  const { patients, nextCursor } = await getPatientsPage(session.clinicId);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="inline-block border-b-4 border-rust-600 pb-1 font-display text-2xl font-bold text-brown-900">
          Patients
        </h1>
        <Link
          href="/dashboard/patients/new"
          className="rounded-lg bg-rust-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rust-700"
        >
          + New Patient
        </Link>
      </div>

      <PatientsTable initialPatients={patients} initialCursor={nextCursor} />
    </div>
  );
}
