import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPatients } from "@/lib/firestore/patients";
import { getClinicAppointments } from "@/lib/firestore/appointments";
import { getClinicVisits } from "@/lib/firestore/visits";
import { getClinicPackages } from "@/lib/firestore/packages";
import { getClinicReceipts } from "@/lib/firestore/receipts";
import { computeAppointmentPipelineMaps } from "@/lib/overview";
import AppointmentsClient from "@/components/appointments/AppointmentsClient";

export default async function AppointmentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [patients, appointments, visits, packages, receipts] = await Promise.all([
    getPatients(session.clinicId),
    getClinicAppointments(session.clinicId),
    getClinicVisits(session.clinicId),
    getClinicPackages(session.clinicId),
    getClinicReceipts(session.clinicId),
  ]);

  const { visitIdByAppointmentId, receiptedAppointmentIds } = computeAppointmentPipelineMaps(visits, receipts);

  return (
    <AppointmentsClient
      clinicId={session.clinicId}
      patients={patients}
      initialAppointments={appointments}
      visits={visits}
      packages={packages}
      visitIdByAppointmentId={visitIdByAppointmentId}
      receiptedAppointmentIds={receiptedAppointmentIds}
    />
  );
}
