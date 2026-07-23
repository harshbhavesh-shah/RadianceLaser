import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { SessionType, Visit, VisitAreaEntry } from "@/types";

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
  fields: Record<string, string | number>; // rollup — see lib/visitAreas.ts
  areas: VisitAreaEntry[]; // one or more treated areas/parts for this visit
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
    areas: input.areas,
    createdAt: Date.now(),
  };
  await docRef.set(visit);
  return docRef.id;
}

/** Overwrites an existing visit's date/areas (and their computed fields
 * rollup) in place — used by the session/visit import's "Replace" duplicate
 * option, so re-importing a corrected file updates the record already on
 * file instead of leaving it untouched (Skip) or piling on a second copy. */
export async function updateVisit(
  visitId: string,
  input: { date: string; fields: Record<string, string | number>; areas: VisitAreaEntry[] }
): Promise<void> {
  await adminDb().collection("visits").doc(visitId).update({
    date: input.date,
    fields: input.fields,
    areas: input.areas,
  });
}
