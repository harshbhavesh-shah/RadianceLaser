import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { Receipt } from "@/types";

/** Receipts for one patient, newest first — same single equality-query
 * pattern as getPatientVisits/getPatientConsentForms, no composite index
 * needed. */
export async function getPatientReceipts(clinicId: string, patientId: string): Promise<Receipt[]> {
  const snap = await adminDb().collection("receipts").where("patientId", "==", patientId).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Receipt)
    .filter((r) => r.clinicId === clinicId) // defense in depth
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Every receipt across the whole clinic — used by the Documents page's
 * clinic-wide receipts list. Single equality query, no composite index. */
export async function getClinicReceipts(clinicId: string): Promise<Receipt[]> {
  const snap = await adminDb().collection("receipts").where("clinicId", "==", clinicId).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Receipt)
    .sort((a, b) => b.createdAt - a.createdAt);
}
