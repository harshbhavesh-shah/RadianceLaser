import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { PatientPhoto } from "@/types";

/**
 * All before/after photos logged for a patient, newest first. Single
 * equality query on patientId (same pattern as getPatientVisits) — no
 * composite index needed, and sorting/filtering by visit or sensitivity
 * happens client-side in the gallery, which is trivial at one patient's
 * scale.
 */
export async function getPatientPhotos(clinicId: string, patientId: string): Promise<PatientPhoto[]> {
  const snap = await adminDb()
    .collection("patientPhotos")
    .where("patientId", "==", patientId)
    .get();

  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as PatientPhoto)
    .filter((photo) => photo.clinicId === clinicId) // defense in depth
    .sort((a, b) => b.createdAt - a.createdAt);
}
