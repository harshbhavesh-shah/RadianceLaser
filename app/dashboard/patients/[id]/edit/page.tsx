import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPatient } from "@/lib/firestore/patients";
import EditPatientForm from "./EditPatientForm";

export default async function EditPatientPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const patient = await getPatient(session.clinicId, params.id);
  if (!patient) notFound();

  return <EditPatientForm patient={patient} />;
}
