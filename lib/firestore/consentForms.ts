import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { ConsentForm, ConsentFormTemplate } from "@/types";

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

/** Every signed consent form across the whole clinic — used by the
 * Documents page's clinic-wide list. Single equality query, no composite
 * index. Patient names aren't stored on ConsentForm itself, so the caller
 * joins against the clinic's patient list (already fetched alongside this). */
export async function getClinicConsentForms(clinicId: string): Promise<ConsentForm[]> {
  const snap = await adminDb().collection("consentForms").where("clinicId", "==", clinicId).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as ConsentForm)
    .sort((a, b) => b.signedAt - a.signedAt);
}
