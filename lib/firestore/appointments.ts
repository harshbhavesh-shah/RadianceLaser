import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { Appointment } from "@/types";

/** Every appointment across the whole clinic — single equality query on
 * clinicId, no composite index required. Filtering by date range/view
 * happens client-side in lib/calendar.ts, which is cheap at the scale of
 * one clinic's appointment history. */
export async function getClinicAppointments(clinicId: string): Promise<Appointment[]> {
  const snap = await adminDb().collection("appointments").where("clinicId", "==", clinicId).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Appointment);
}

/** Just one day's appointments — backs Dashboard's "Today's Schedule",
 * which never needs the clinic's whole appointment history to render.
 * Needs a composite index (clinicId Asc, date Asc) — see
 * firestore.indexes.json. */
export async function getAppointmentsForDate(clinicId: string, dateStr: string): Promise<Appointment[]> {
  const snap = await adminDb()
    .collection("appointments")
    .where("clinicId", "==", clinicId)
    .where("date", "==", dateStr)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Appointment);
}

/** Whether this clinic has ever booked a single appointment — backs the
 * onboarding checklist's "Book an appointment" step. A `limit(1)` existence
 * check costs at most 1 read, instead of fetching every appointment just
 * to check `.length > 0`. */
export async function clinicHasAnyAppointment(clinicId: string): Promise<boolean> {
  const snap = await adminDb().collection("appointments").where("clinicId", "==", clinicId).limit(1).get();
  return !snap.empty;
}
