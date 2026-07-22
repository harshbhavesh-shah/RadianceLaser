import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { SessionTypeDef } from "@/types";

/** Clinic-defined major machine types (e.g. "CO2 Laser") — on top of the
 * built-in Q-Switch/LHR types. See lib/sessionTypes.ts for how these get
 * merged into the effective config used across the app. */
export async function getClinicSessionTypeDefs(clinicId: string): Promise<SessionTypeDef[]> {
  const snap = await adminDb()
    .collection("sessionTypeDefs")
    .where("clinicId", "==", clinicId)
    .get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as SessionTypeDef)
    .sort((a, b) => a.createdAt - b.createdAt);
}
