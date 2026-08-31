"use server";

import { getSession } from "@/lib/session";
import {
  createAppointment,
  updateAppointment,
  deleteAppointment,
  linkAppointmentToPatient,
  type AppointmentInput,
} from "@/lib/db/appointments";
import type { Appointment } from "@/types";

// Server Actions backing AppointmentFormModal and UnlinkedBookingPanel —
// replaces their old direct Firestore client-SDK writes now that
// Appointment lives entirely in Postgres (lib/db/appointments.ts).

export type AppointmentFormFields = AppointmentInput;

export async function createAppointmentAction(
  input: AppointmentFormFields
): Promise<{ id: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  try {
    const id = await createAppointment({ clinicId: session.clinicId, ...input });
    return { id };
  } catch (err) {
    console.error("Failed to create appointment:", err);
    return { error: "Couldn't save this appointment. Please try again." };
  }
}

export async function updateAppointmentAction(
  appointmentId: string,
  input: AppointmentFormFields
): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  try {
    await updateAppointment(session.clinicId, appointmentId, input);
    return { ok: true };
  } catch (err) {
    console.error("Failed to update appointment:", err);
    return { error: "Couldn't save this appointment. Please try again." };
  }
}

export async function deleteAppointmentAction(appointmentId: string): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  try {
    await deleteAppointment(session.clinicId, appointmentId);
    return { ok: true };
  } catch (err) {
    console.error("Failed to delete appointment:", err);
    return { error: "Couldn't delete this appointment. Please try again." };
  }
}

/** Links an unlinked public booking to a (new-or-existing) patient — used
 * by UnlinkedBookingPanel. Just an update; the appointment keeps its id. */
export async function linkPublicBookingAction(
  appointment: Appointment,
  patientId: string,
  patientName: string,
  patientPhone: string
): Promise<{ appointment: Appointment } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  try {
    await linkAppointmentToPatient(session.clinicId, appointment.id, patientId, patientName, patientPhone);
    return { appointment: { ...appointment, patientId, patientName, patientPhone } };
  } catch (err) {
    console.error("Failed to link booking to a patient:", err);
    return { error: "Something went wrong. Please try again." };
  }
}
