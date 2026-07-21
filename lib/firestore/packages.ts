import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { Package } from "@/types";

export async function getPatientPackages(clinicId: string, patientId: string): Promise<Package[]> {
  const snap = await adminDb()
    .collection("packages")
    .where("patientId", "==", patientId)
    .get();

  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Package)
    .filter((pkg) => pkg.clinicId === clinicId); // defense in depth
}

/** Every package across the whole clinic — used by the clinic-wide
 * Packages list and by revenue analytics (a package purchase counts as
 * revenue on its purchase date). Single equality query, no composite index. */
export async function getClinicPackages(clinicId: string): Promise<Package[]> {
  const snap = await adminDb().collection("packages").where("clinicId", "==", clinicId).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Package);
}