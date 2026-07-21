import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { Visit } from "@/types";

/**
 * Fetches every logged visit for a patient, across all session types.
 * Deliberately a single equality query (patientId only, no orderBy) so it
 * never needs a composite index — sorting and splitting by sessionType
 * happens client-side, which is trivial at the scale of one patient's
 * history.
 */
export async function getPatientVisits(clinicId: string, patientId: string): Promise<Visit[]> {
  const snap = await adminDb()
    .collection("visits")
    .where("patientId", "==", patientId)
    .get();

  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Visit)
    .filter((visit) => visit.clinicId === clinicId); // defense in depth
}

/**
 * Fetches every visit across the whole clinic — used by the Overview page
 * for stats/analytics. Same reasoning as above: single equality query on
 * clinicId, no orderBy/date-range, so no composite index required. Date
 * filtering (today/this month/etc.) happens in lib/analytics.ts after the
 * fetch, which is cheap at the scale of one clinic's visit history.
 */
export async function getClinicVisits(clinicId: string): Promise<Visit[]> {
  const snap = await adminDb().collection("visits").where("clinicId", "==", clinicId).get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Visit);
}
