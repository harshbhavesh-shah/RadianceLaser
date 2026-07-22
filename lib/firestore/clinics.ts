import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { Clinic } from "@/types";

export async function getClinic(clinicId: string): Promise<Clinic | null> {
  const snap = await adminDb().collection("clinics").doc(clinicId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Clinic;
}
