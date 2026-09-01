import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPatient, checkPatientRetentionFloor } from "@/lib/db/patients";
import EditPatientForm from "./EditPatientForm";

export default async function EditPatientPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const patient = await getPatient(session.clinicId, params.id);
  if (!patient) notFound();

  const retention = session.role === "owner" ? await checkPatientRetentionFloor(session.clinicId, patient.id) : null;

  return <EditPatientForm patient={patient} canErase={session.role === "owner"} retention={retention} />;
}
