"use server";

import { getSession } from "@/lib/session";
import {
  createAppointment,
  updateAppointment,
  deleteAppointment,
  deleteUnlinkedPublicBooking,
  promoteAppointment,
  type AppointmentInput,
} from "@/lib/db/appointments";
import type { Appointment } from "@/types";

// Server Actions backing AppointmentFormModal and UnlinkedBookingPanel —
// replaces their old direct Firestore client-SDK writes now that
// internally-booked Appointments live in Postgres (lib/db/appointments.ts).
// `isPublicBooking` (== the appointment being edited had patientId "" —
// i.e. it's a Firestore doc from the marketing site's public booking form,
// not yet promoted) routes the save/delete to the right store; see
// prisma/schema.prisma's Appointment model comment for the full picture.

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

/** Saves an edit. When `isPublicBooking` is true the id in the returned
 * result will differ from `appointmentId` — the appointment was promoted
 * into a new Postgres row rather than updated in place. Callers must use
 * the returned id, not the one they passed in. */
export async function updateAppointmentAction(
  appointmentId: string,
  isPublicBooking: boolean,
  input: AppointmentFormFields
): Promise<{ id: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  try {
    if (isPublicBooking) {
      const id = await promoteAppointment(appointmentId, { clinicId: session.clinicId, ...input });
      return { id };
    }
    await updateAppointment(session.clinicId, appointmentId, input);
    return { id: appointmentId };
  } catch (err) {
    console.error("Failed to update appointment:", err);
    return { error: "Couldn't save this appointment. Please try again." };
  }
}

export async function deleteAppointmentAction(
  appointmentId: string,
  isPublicBooking: boolean
): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  try {
    if (isPublicBooking) {
      await deleteUnlinkedPublicBooking(appointmentId);
    } else {
      await deleteAppointment(session.clinicId, appointmentId);
    }
    return { ok: true };
  } catch (err) {
    console.error("Failed to delete appointment:", err);
    return { error: "Couldn't delete this appointment. Please try again." };
  }
}

/** Links an unlinked public booking to a (new-or-existing) patient — used
 * by UnlinkedBookingPanel. Always a promotion: the booking moves out of
 * Firestore into Postgres with the new patientId attached, picking up a
 * fresh id in the process. */
export async function linkPublicBookingAction(
  appointment: Appointment,
  patientId: string,
  patientName: string,
  patientPhone: string
): Promise<{ appointment: Appointment } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  try {
    const id = await promoteAppointment(appointment.id, {
      clinicId: session.clinicId,
      patientId,
      patientName,
      patientPhone,
      sessionType: appointment.sessionType,
      date: appointment.date,
      time: appointment.time,
      durationMinutes: appointment.durationMinutes,
      status: appointment.status,
      notes: appointment.notes,
    });
    return { appointment: { ...appointment, id, patientId, patientName, patientPhone } };
  } catch (err) {
    console.error("Failed to link booking to a patient:", err);
    return { error: "Something went wrong. Please try again." };
  }
}
