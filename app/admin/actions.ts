"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getAdminSession } from "@/lib/session";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { clinicCacheTag } from "@/lib/firestore/clinics";
import type { AdminSession, Clinic } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
  return session;
}

export interface AdminActionResult {
  error?: string;
}

/**
 * Adds `days` to whichever deadline currently governs a clinic's access —
 * subscriptionRenewsAt if it's ever paid (subscriptionStatus "active", or a
 * lapsed/"canceled" clinic that has a subscriptionRenewsAt on record),
 * otherwise trialEndsAt. Extends from the later of "now" or the clinic's
 * current deadline, not just "now + days", so this can't accidentally
 * shorten a clinic's access if used on one that isn't actually close to
 * expiring. A "canceled" clinic that had paid before comes back as
 * "active" rather than needing a separate reactivate action.
 */
export async function extendAccessAction(clinicId: string, days: number): Promise<AdminActionResult> {
  try {
    await requireSuperAdmin();

    if (!Number.isFinite(days) || days <= 0) {
      return { error: "Enter a positive number of days." };
    }

    const clinicRef = adminDb().collection("clinics").doc(clinicId);
    const snap = await clinicRef.get();
    if (!snap.exists) return { error: "Clinic not found." };

    const clinic = snap.data() as Clinic;
    const hasEverPaid = clinic.subscriptionStatus === "active" || clinic.subscriptionRenewsAt != null;

    if (hasEverPaid) {
      const current = clinic.subscriptionRenewsAt ?? 0;
      const newRenewsAt = Math.max(Date.now(), current) + days * DAY_MS;
      await clinicRef.update({ subscriptionStatus: "active", subscriptionRenewsAt: newRenewsAt });
    } else {
      const current = clinic.trialEndsAt ?? 0;
      const newTrialEndsAt = Math.max(Date.now(), current) + days * DAY_MS;
      await clinicRef.update({ subscriptionStatus: "trialing", trialEndsAt: newTrialEndsAt });
    }

    revalidateTag(clinicCacheTag(clinicId));
    revalidatePath("/admin");
    return {};
  } catch (err) {
    console.error("Failed to extend clinic access:", err);
    return { error: "Couldn't extend access. Please try again." };
  }
}

/** Immediately locks a clinic out of writes (reads stay available — same
 * hard-lock behavior as an expired trial, see firestore.rules
 * clinicIsActive()), regardless of what its trial/subscription dates say. */
export async function terminateAccessAction(clinicId: string): Promise<AdminActionResult> {
  try {
    await requireSuperAdmin();

    const clinicRef = adminDb().collection("clinics").doc(clinicId);
    const snap = await clinicRef.get();
    if (!snap.exists) return { error: "Clinic not found." };

    await clinicRef.update({ subscriptionStatus: "canceled" });

    revalidateTag(clinicCacheTag(clinicId));
    revalidatePath("/admin");
    return {};
  } catch (err) {
    console.error("Failed to terminate clinic access:", err);
    return { error: "Couldn't terminate access. Please try again." };
  }
}

// Every collection that scopes documents to a clinic by a `clinicId` field
// — everything a clinic has ever created. Kept as one flat list so adding a
// new clinic-scoped collection later is a one-line addition here, not a
// silent gap in what delete actually removes. whatsappConnections is
// deliberately not here — its doc id is the clinicId itself, deleted
// directly below instead of via a where() query.
const CLINIC_SCOPED_COLLECTIONS = [
  "patients",
  "visits",
  "packages",
  "appointments",
  "receipts",
  "staff",
  "sessionTypeDefs",
  "machines",
  "consentFormTemplates",
  "consentForms",
  "patientPhotos",
  "messageTemplates",
  "payments",
] as const;

const BATCH_CHUNK_SIZE = 400; // under Firestore's 500-write batch limit

async function deleteQueryInChunks(query: FirebaseFirestore.Query): Promise<number> {
  const db = adminDb();
  const snap = await query.get();
  let deleted = 0;
  for (let i = 0; i < snap.docs.length; i += BATCH_CHUNK_SIZE) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + BATCH_CHUNK_SIZE)) batch.delete(doc.ref);
    await batch.commit();
    deleted += Math.min(BATCH_CHUNK_SIZE, snap.docs.length - i);
  }
  return deleted;
}

/**
 * Permanently deletes a clinic and everything it owns — every clinic-scoped
 * Firestore collection (see CLINIC_SCOPED_COLLECTIONS), its WhatsApp
 * connection doc, every staff member's Firebase Auth account and any
 * pending 2FA challenge of theirs, and finally the clinic doc itself.
 * Irreversible — there's no soft-delete/undo here, unlike
 * terminateAccessAction which just locks writes. The confirmation typing
 * the clinic's exact name lives client-side (ClinicsTable) since that's a
 * UX safeguard, not a security boundary — requireSuperAdmin() is the real
 * gate.
 */
export async function deleteClinicAction(clinicId: string): Promise<AdminActionResult> {
  try {
    await requireSuperAdmin();

    const db = adminDb();
    const auth = adminAuth();
    const clinicRef = db.collection("clinics").doc(clinicId);
    const snap = await clinicRef.get();
    if (!snap.exists) return { error: "Clinic not found." };

    // Staff docs double as the id of who to delete from Firebase Auth —
    // collect their uids before the docs themselves get deleted below.
    const staffSnap = await db.collection("staff").where("clinicId", "==", clinicId).get();
    const staffUids = staffSnap.docs.map((d) => d.id);

    for (const collection of CLINIC_SCOPED_COLLECTIONS) {
      await deleteQueryInChunks(db.collection(collection).where("clinicId", "==", clinicId));
    }
    await db.collection("whatsappConnections").doc(clinicId).delete().catch(() => {});

    for (const uid of staffUids) {
      await db.collection("twoFactorChallenges").doc(uid).delete().catch(() => {});
      await auth.deleteUser(uid).catch((err) => {
        // A uid with no matching Auth user (already removed some other way)
        // shouldn't block the rest of the deletion — log and move on.
        console.error(`Failed to delete Auth user ${uid} for clinic ${clinicId}:`, err);
      });
    }

    await clinicRef.delete();

    revalidateTag(clinicCacheTag(clinicId));
    revalidatePath("/admin");
    return {};
  } catch (err) {
    console.error("Failed to delete clinic:", err);
    return { error: "Couldn't delete this clinic. Please try again." };
  }
}
