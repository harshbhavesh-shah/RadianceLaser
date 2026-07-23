import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { SessionType, Visit } from "@/types";

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

export interface CreateVisitInput {
  clinicId: string;
  patientId: string;
  sessionType: SessionType;
  date: string; // YYYY-MM-DD
  fields: Record<string, string | number>;
}

/**
 * Admin-SDK-side visit creation — used by the session/visit history bulk
 * import (see app/dashboard/settings/visitImportActions.ts). The normal
 * "Log Visit" flow (components/VisitFormModal.tsx) writes directly from the
 * client via the Firestore client SDK instead; this exists so a server
 * action can create many visits in one request without round-tripping
 * through the browser.
 */
export async function createVisit(input: CreateVisitInput): Promise<string> {
  const docRef = adminDb().collection("visits").doc();
  const visit: Omit<Visit, "id"> = {
    clinicId: input.clinicId,
    patientId: input.patientId,
    sessionType: input.sessionType,
    date: input.date,
    fields: input.fields,
    createdAt: Date.now(),
  };
  await docRef.set(visit);
  return docRef.id;
}
