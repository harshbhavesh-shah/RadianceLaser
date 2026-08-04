import "server-only";
import { unstable_cache } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import type { Clinic } from "@/types";

export function clinicCacheTag(clinicId: string): string {
  return `clinic-${clinicId}`;
}

async function fetchClinic(clinicId: string): Promise<Clinic | null> {
  const snap = await adminDb().collection("clinics").doc(clinicId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Clinic;
}

/**
 * The clinic doc rarely changes (name/address/preferences, edited only from
 * Settings), but app/dashboard/layout.tsx was reading it fresh from
 * Firestore on every single dashboard navigation, since getSession() makes
 * the whole layout dynamic (no request-level caching applies by default).
 * Cached here across requests via unstable_cache, tagged so the three
 * mutating actions in app/dashboard/settings/actions.ts
 * (updateClinicName/updateClinicAddress/updateStatsWindow) can invalidate it
 * immediately with revalidateTag(clinicCacheTag(clinicId)) instead of
 * waiting out the 5-minute revalidate window.
 */
export function getClinic(clinicId: string): Promise<Clinic | null> {
  return unstable_cache(fetchClinic, ["clinic"], {
    tags: [clinicCacheTag(clinicId)],
    revalidate: 300,
  })(clinicId);
}
