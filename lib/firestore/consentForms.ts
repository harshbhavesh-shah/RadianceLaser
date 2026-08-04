import "server-only";
import { FieldPath } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { ConsentForm, ConsentFormTemplate } from "@/types";

const CONSENT_FORMS_PAGE_SIZE = 25;

export async function getClinicConsentTemplates(clinicId: string): Promise<ConsentFormTemplate[]> {
  const snap = await adminDb()
    .collection("consentFormTemplates")
    .where("clinicId", "==", clinicId)
    .get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as ConsentFormTemplate)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Signed consent forms for one patient, newest first — same single
 * equality-query pattern as getPatientVisits/getPatientPhotos, no composite
 * index needed. */
export async function getPatientConsentForms(clinicId: string, patientId: string): Promise<ConsentForm[]> {
  const snap = await adminDb()
    .collection("consentForms")
    .where("patientId", "==", patientId)
    .get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as ConsentForm)
    .filter((form) => form.clinicId === clinicId) // defense in depth
    .sort((a, b) => b.signedAt - a.signedAt);
}

/** Every signed consent form across the whole clinic, in one read. Patient
 * names aren't stored on ConsentForm itself, so a caller needing to display
 * them joins against the clinic's patient list separately. The Documents
 * page's consent-forms *list* uses getClinicConsentFormsPage below instead,
 * since that's the one place someone scrolls through the full signing
 * history growing over a clinic's lifetime. */
export async function getClinicConsentForms(clinicId: string): Promise<ConsentForm[]> {
  const snap = await adminDb().collection("consentForms").where("clinicId", "==", clinicId).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as ConsentForm)
    .sort((a, b) => b.signedAt - a.signedAt);
}

export interface ConsentFormsPage {
  forms: ConsentForm[];
  nextCursor: string | null;
}

function encodeCursor(signedAt: number, id: string): string {
  return `${signedAt}_${id}`;
}

function decodeCursor(cursor: string): [number, string] {
  const separatorIndex = cursor.lastIndexOf("_");
  return [Number(cursor.slice(0, separatorIndex)), cursor.slice(separatorIndex + 1)];
}

/**
 * One page of the clinic's signed consent forms, newest first — backs the
 * Documents page's Consent Forms tab so opening it doesn't read every form
 * ever signed, only the page shown. Same cursor + document-ID-tiebreak
 * pattern as getPatientsPage in lib/firestore/patients.ts. Needs a composite
 * index (clinicId Ascending, signedAt Descending, __name__ Descending) —
 * Firestore will prompt for it.
 *
 * Same caveat as getClinicReceiptsPage: the panel's search bar only searches
 * whatever page is currently loaded, not the whole clinic — a clinic-wide
 * search would need denormalizing a lowercased patient name onto
 * ConsentForm for a proper prefix query, which hasn't been done here.
 */
export async function getClinicConsentFormsPage(
  clinicId: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<ConsentFormsPage> {
  const limit = opts.limit ?? CONSENT_FORMS_PAGE_SIZE;

  let query = adminDb()
    .collection("consentForms")
    .where("clinicId", "==", clinicId)
    .orderBy("signedAt", "desc")
    .orderBy(FieldPath.documentId(), "desc")
    .limit(limit);

  if (opts.cursor) {
    const [signedAt, id] = decodeCursor(opts.cursor);
    query = query.startAfter(signedAt, id);
  }

  const snap = await query.get();
  const forms = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ConsentForm);

  const lastDoc = snap.docs[snap.docs.length - 1];
  const nextCursor =
    snap.docs.length === limit && lastDoc
      ? encodeCursor((lastDoc.data() as ConsentForm).signedAt, lastDoc.id)
      : null;

  return { forms, nextCursor };
}
