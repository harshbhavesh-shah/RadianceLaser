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
