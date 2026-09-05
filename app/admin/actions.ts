"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getAdminSession } from "@/lib/session";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { prisma } from "@/lib/db/client";
import { clinicCacheTag, updateClinicSubscription, deleteClinic } from "@/lib/db/clinics";
import { updatePlatformPricing, PLATFORM_SETTINGS_CACHE_TAG } from "@/lib/db/platformSettings";
import type { AdminSession } from "@/types";

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
 * The single knob that changes the software's price everywhere at once —
 * see lib/db/platformSettings.ts for the read side (landing page, signup
 * page, dashboard billing, and what Razorpay actually charges all read
 * this same row). revalidateTag makes existing pages pick it up
 * immediately rather than waiting out the cache's 5-minute window.
 */
export async function updatePlatformPriceAction(annualPriceInr: number): Promise<AdminActionResult> {
  try {
    const session = await requireSuperAdmin();

    if (!Number.isFinite(annualPriceInr) || annualPriceInr <= 0) {
      return { error: "Enter a positive price." };
    }
    if (!Number.isInteger(annualPriceInr)) {
      return { error: "Enter a whole number of rupees." };
    }

    await updatePlatformPricing(annualPriceInr, session.email || "unknown");
    revalidateTag(PLATFORM_SETTINGS_CACHE_TAG);
    revalidatePath("/admin/pricing");
    revalidatePath("/");
    revalidatePath("/signup");
    return {};
  } catch (err) {
    console.error("Failed to update platform pricing:", err);
    return { error: "Couldn't save this price. Please try again." };
  }
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

    // A direct, uncached Postgres read (not lib/db/clinics.ts getClinic,
    // which caches for 5 minutes) — the max(now, current) extension math
    // below needs this clinic's actual current deadline, not a stale one
    // from before another admin action just changed it.
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) return { error: "Clinic not found." };

    const hasEverPaid = clinic.subscriptionStatus === "active" || clinic.subscriptionRenewsAt != null;

    if (hasEverPaid) {
      const current = Number(clinic.subscriptionRenewsAt ?? 0);
      const newRenewsAt = Math.max(Date.now(), current) + days * DAY_MS;
      await updateClinicSubscription(clinicId, { subscriptionStatus: "active", subscriptionRenewsAt: newRenewsAt });
    } else {
      const current = Number(clinic.trialEndsAt ?? 0);
      const newTrialEndsAt = Math.max(Date.now(), current) + days * DAY_MS;
      await updateClinicSubscription(clinicId, { subscriptionStatus: "trialing", trialEndsAt: newTrialEndsAt });
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

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true } });
    if (!clinic) return { error: "Clinic not found." };

    await updateClinicSubscription(clinicId, { subscriptionStatus: "canceled" });

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
//
// Every collection listed here has moved to Postgres (see
// prisma/schema.prisma) and is deleted from there separately, below —
// this list is now purely a safety net for any clinic whose Firestore-era
// records were never touched by that move. Appointment no longer has the
// "public bookings can still be live in Firestore at delete time" wrinkle
// it used to: the marketing site's public booking form posts straight to
// Postgres now (see app/api/public/appointments/route.ts), so there's
// nothing new landing in Firestore's appointments collection to protect
// against — same safety-net-only reasoning as everything else here.
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
    // Checked in both stores, same reasoning as the staff uid collection
    // just below: a clinic created before Clinic moved to Postgres (see
    // lib/db/clinics.ts) may only exist as a Firestore doc.
    const [clinicRow, clinicSnap] = await Promise.all([
      prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true } }),
      db.collection("clinics").doc(clinicId).get(),
    ]);
    if (!clinicRow && !clinicSnap.exists) return { error: "Clinic not found." };

    // Staff docs/rows double as the id of who to delete from Firebase Auth —
    // collect their uids before deleting them below. Checked in both
    // stores: StaffMember moved to Postgres (see lib/db/staff.ts), but a
    // clinic whose staff were created before that move may still have
    // Firestore-era staff docs that were never touched by it (this
    // migration deliberately doesn't backfill old data — see
    // prisma/schema.prisma's chunk-1 comment) — missing either would leave
    // orphaned Auth accounts behind.
    const [staffSnap, staffRows] = await Promise.all([
      db.collection("staff").where("clinicId", "==", clinicId).get(),
      prisma.staffMember.findMany({ where: { clinicId }, select: { id: true } }),
    ]);
    const staffUids = Array.from(new Set([...staffSnap.docs.map((d) => d.id), ...staffRows.map((r) => r.id)]));

    for (const collection of CLINIC_SCOPED_COLLECTIONS) {
      await deleteQueryInChunks(db.collection(collection).where("clinicId", "==", clinicId));
    }
    await db.collection("whatsappConnections").doc(clinicId).delete().catch(() => {});

    // Patient rows cascade-delete their Visits, Packages, Appointments,
    // Receipts, ConsentForms, and PatientPhotos (each FK'd to Patient with
    // onDelete: Cascade) — one query covers all seven Postgres tables.
    // ReceiptCounter, Machine, StaffMember, SessionTypeDef,
    // ConsentFormTemplate, MessageTemplate, and Payment aren't FK'd to
    // anything (all keyed by clinicId directly, not patientId — see
    // prisma/schema.prisma), so each needs its own explicit delete.
    await prisma.patient.deleteMany({ where: { clinicId } });
    await prisma.receiptCounter.deleteMany({ where: { clinicId } });
    await prisma.machine.deleteMany({ where: { clinicId } });
    await prisma.staffMember.deleteMany({ where: { clinicId } });
    await prisma.sessionTypeDef.deleteMany({ where: { clinicId } });
    await prisma.consentFormTemplate.deleteMany({ where: { clinicId } });
    await prisma.messageTemplate.deleteMany({ where: { clinicId } });
    await prisma.payment.deleteMany({ where: { clinicId } });
    // WhatsAppConnection's Postgres id is the clinicId itself (see
    // prisma/schema.prisma), same as its Firestore doc id above.
    await prisma.whatsAppConnection.deleteMany({ where: { id: clinicId } });

    for (const uid of staffUids) {
      await prisma.twoFactorChallenge.deleteMany({ where: { uid } });
      await auth.deleteUser(uid).catch((err) => {
        // A uid with no matching Auth user (already removed some other way)
        // shouldn't block the rest of the deletion — log and move on.
        console.error(`Failed to delete Auth user ${uid} for clinic ${clinicId}:`, err);
      });
    }

    // deleteClinic handles both the Postgres row (if any) and the Firestore
    // mirror doc; a clinic pre-dating the Postgres move has no Postgres row
    // to delete, so guard that half of it explicitly.
    if (clinicRow) {
      await deleteClinic(clinicId);
    } else {
      await db.collection("clinics").doc(clinicId).delete();
    }

    revalidateTag(clinicCacheTag(clinicId));
    revalidatePath("/admin");
    return {};
  } catch (err) {
    console.error("Failed to delete clinic:", err);
    return { error: "Couldn't delete this clinic. Please try again." };
  }
}
