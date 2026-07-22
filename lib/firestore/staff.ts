import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { StaffMember } from "@/types";

export async function getClinicStaff(clinicId: string): Promise<StaffMember[]> {
  const snap = await adminDb().collection("staff").where("clinicId", "==", clinicId).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as StaffMember)
    .sort((a, b) => a.createdAt - b.createdAt);
}
