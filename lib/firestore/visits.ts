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
 * Fetches every visit across the whole clinic. INTENTIONALLY EXPENSIVE —
 * this reads the entire visits collection, which is fine for a young
 * clinic's few dozen visits but becomes thousands of reads on every call
 * once real history builds up (confirmed: 8,000+ reads per page load after
 * importing a clinic's multi-year history). Only the Analytics page still
 * uses this, because several of its numbers (package utilization, staff/
 * machine usage, area popularity — see lib/analyticsPage.ts) are
 * deliberately all-time, not date-scoped, so there's no cheaper query that
 * gives the same answer without a maintained running-total document
 * (the real fix, not yet built). Every other page that used to call this
 * (Dashboard, Appointments, Packages, Documents) has been moved to one of
 * the targeted queries below instead — don't reach for this one for a new
 * feature without checking whether a narrower query actually covers it.
 */
export async function getClinicVisits(clinicId: string): Promise<Visit[]> {
  const snap = await adminDb().collection("visits").where("clinicId", "==", clinicId).get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Visit);
}

/** Most recently *entered* visits (by createdAt, not visit date) — backs
 * Dashboard's "Recent Activity" feed, which only ever shows a handful.
 * Needs a composite index (clinicId Asc, createdAt Desc) — see
 * firestore.indexes.json. */
export async function getRecentClinicVisits(clinicId: string, limitCount = 8): Promise<Visit[]> {
  const snap = await adminDb()
    .collection("visits")
    .where("clinicId", "==", clinicId)
    .orderBy("createdAt", "desc")
    .limit(limitCount)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Visit);
}

/** Visits on or after a given date — covers "today/this week/this month"
 * stats and the monthly revenue chart without reading the clinic's entire
 * history. Needs a composite index (clinicId Asc, date Asc) — see
 * firestore.indexes.json. */
export async function getClinicVisitsSince(clinicId: string, sinceDateStr: string): Promise<Visit[]> {
  const snap = await adminDb()
    .collection("visits")
    .where("clinicId", "==", clinicId)
    .where("date", ">=", sinceDateStr)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Visit);
}

/** Visits with a follow-up date due (today or earlier) — backs Dashboard's
 * follow-up alerts (see lib/overview.ts computeFollowUpAlerts). A visit
 * with no followUpDate field at all is naturally excluded by the `<=`
 * filter, not just ones where it's in the future — so this only ever
 * returns the (usually tiny) set of visits someone actually flagged. Needs
 * a composite index (clinicId Asc, followUpDate Asc) — see
 * firestore.indexes.json. */
export async function getVisitsWithDueFollowUps(clinicId: string, todayStr: string): Promise<Visit[]> {
  const snap = await adminDb()
    .collection("visits")
    .where("clinicId", "==", clinicId)
    .where("followUpDate", "<=", todayStr)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Visit);
}

/** Every visit redeemed against one package — exactly what
 * computePackageLedger (lib/packages.ts) actually needs, instead of a
 * patient's entire visit history filtered down in memory. Needs a
 * composite index (clinicId Asc, packageId Asc) — see
 * firestore.indexes.json. */
export async function getVisitsByPackageId(clinicId: string, packageId: string): Promise<Visit[]> {
  const snap = await adminDb()
    .collection("visits")
    .where("clinicId", "==", clinicId)
    .where("packageId", "==", packageId)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Visit);
}

const FIRESTORE_IN_CHUNK_SIZE = 10; // Admin SDK "in" queries max out at 30; chunked well under that

/** Visits linked to any of the given appointments — backs the "has this
 * appointment already been logged?" pipeline check (see
 * lib/overview.ts computeAppointmentPipelineMaps) for just the appointments
 * actually on screen (typically today's, a handful), instead of scanning
 * every visit the clinic has ever logged. Needs a composite index
 * (clinicId Asc, appointmentId Asc) — see firestore.indexes.json. */
export async function getVisitsByAppointmentIds(clinicId: string, appointmentIds: string[]): Promise<Visit[]> {
  if (appointmentIds.length === 0) return [];
  const results: Visit[] = [];
  for (let i = 0; i < appointmentIds.length; i += FIRESTORE_IN_CHUNK_SIZE) {
    const chunk = appointmentIds.slice(i, i + FIRESTORE_IN_CHUNK_SIZE);
    const snap = await adminDb()
      .collection("visits")
      .where("clinicId", "==", clinicId)
      .where("appointmentId", "in", chunk)
      .get();
    results.push(...snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Visit));
  }
  return results;
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
