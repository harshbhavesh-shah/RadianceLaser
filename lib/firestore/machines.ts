import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { Machine } from "@/types";

export async function getClinicMachines(clinicId: string): Promise<Machine[]> {
  const snap = await adminDb().collection("machines").where("clinicId", "==", clinicId).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Machine)
    .sort((a, b) => a.createdAt - b.createdAt);
}
