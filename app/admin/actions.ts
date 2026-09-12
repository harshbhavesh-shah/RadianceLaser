"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession, startImpersonation, stopImpersonation, peekImpersonation } from "@/lib/session";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { prisma } from "@/lib/db/client";
import { clinicCacheTag, updateClinicSubscription, updateClinicPlanTier, deleteClinic } from "@/lib/db/clinics";
import type { PlanTier } from "@/lib/entitlements";
import { updatePlatformPricing, PLATFORM_SETTINGS_CACHE_TAG, getAnnualPriceInr } from "@/lib/db/platformSettings";
import { createLedgerEntry } from "@/lib/db/ledger";
import { createAdminAuditLogEntry } from "@/lib/db/adminAuditLog";
import { SUBSCRIPTION_LENGTH_DAYS } from "@/lib/subscription";
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

    const oldPriceInr = await getAnnualPriceInr();
    await updatePlatformPricing(annualPriceInr, session.email || "unknown");
    await createAdminAuditLogEntry({
      action: "price_change",
      detail: `₹${oldPriceInr.toLocaleString("en-IN")} → ₹${annualPriceInr.toLocaleString("en-IN")}`,
      performedBy: session.email || "unknown",
    });
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
    const session = await requireSuperAdmin();

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

    await createAdminAuditLogEntry({
      clinicId,
      clinicName: clinic.name,
      action: "extend",
      detail: `+${days} day${days === 1 ? "" : "s"}`,
      performedBy: session.email || "unknown",
    });

    revalidateTag(clinicCacheTag(clinicId));
    revalidatePath("/admin");
    return {};
  } catch (err) {
    console.error("Failed to extend clinic access:", err);
    return { error: "Couldn't extend access. Please try again." };
  }
}

/**
 * Marks a clinic "active" for a full year, exactly as if they'd just paid
 * through Razorpay — for a clinic that actually paid you outside the app
 * (bank transfer, cash, etc.). Unlike extendAccessAction, this always
 * lands on "active" status even for a clinic that's still on/never left
 * its trial, rather than just adding days to whichever deadline currently
 * governs it. Also logs the sale in the Ledger (see app/admin/ledger) at
 * the current platform price, since a payment collected this way would
 * otherwise never show up anywhere in the platform's own bookkeeping —
 * Payment (prisma/schema.prisma) is Razorpay-specific (a required
 * razorpayOrderId), so this isn't recorded there.
 */
export async function activateAccountAction(clinicId: string): Promise<AdminActionResult> {
  try {
    const session = await requireSuperAdmin();

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) return { error: "Clinic not found." };

    const current = Number(clinic.subscriptionRenewsAt ?? 0);
    const newRenewsAt = Math.max(Date.now(), current) + SUBSCRIPTION_LENGTH_DAYS * DAY_MS;
    await updateClinicSubscription(clinicId, { subscriptionStatus: "active", subscriptionRenewsAt: newRenewsAt });

    const annualPriceInr = await getAnnualPriceInr();
    await createLedgerEntry({
      type: "profit",
      amountInr: annualPriceInr,
      description: `Manual activation — ${clinic.name} (1 year)`,
      date: new Date().toISOString().slice(0, 10),
      createdByEmail: session.email || undefined,
    });
    await createAdminAuditLogEntry({
      clinicId,
      clinicName: clinic.name,
      action: "activate",
      detail: `Activated for 1 year (₹${annualPriceInr.toLocaleString("en-IN")})`,
      performedBy: session.email || "unknown",
    });

    revalidateTag(clinicCacheTag(clinicId));
    revalidatePath("/admin");
    revalidatePath("/admin/ledger");
    return {};
  } catch (err) {
    console.error("Failed to activate clinic:", err);
    return { error: "Couldn't activate this clinic. Please try again." };
  }
}

const VALID_TIERS: PlanTier[] = ["free", "basic", "standard", "pro", "enterprise"];

/**
 * Manually sets a clinic's plan tier — the only way to assign a tier while
 * there's no real per-tier checkout yet (see lib/entitlements.ts).
 * enterpriseCenters only applies when planTier is "enterprise"; omitted
 * otherwise so it doesn't overwrite a previously-set value with nothing
 * meaningful.
 */
export async function updateClinicPlanTierAction(
  clinicId: string,
  planTier: PlanTier,
  enterpriseCenters?: number
): Promise<AdminActionResult> {
  try {
    const session = await requireSuperAdmin();

    if (!VALID_TIERS.includes(planTier)) {
      return { error: "Invalid plan tier." };
    }

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true, name: true } });
    if (!clinic) return { error: "Clinic not found." };

    await updateClinicPlanTier(clinicId, {
      planTier,
      ...(planTier === "enterprise" && enterpriseCenters ? { enterpriseCenters } : {}),
    });

    await createAdminAuditLogEntry({
      clinicId,
      clinicName: clinic.name,
      action: "plan_tier_change",
      detail: `Set to ${planTier}${planTier === "enterprise" && enterpriseCenters ? ` (${enterpriseCenters} centers)` : ""}`,
      performedBy: session.email || "unknown",
    });

    revalidateTag(clinicCacheTag(clinicId));
    revalidatePath("/admin");
    return {};
  } catch (err) {
    console.error("Failed to update plan tier:", err);
    return { error: "Couldn't update this clinic's plan tier. Please try again." };
  }
}

/** Immediately locks a clinic out of writes (reads stay available — same
 * hard-lock behavior as an expired trial, see firestore.rules
 * clinicIsActive()), regardless of what its trial/subscription dates say. */
export async function terminateAccessAction(clinicId: string): Promise<AdminActionResult> {
  try {
    const session = await requireSuperAdmin();

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true, name: true } });
    if (!clinic) return { error: "Clinic not found." };

    await updateClinicSubscription(clinicId, { subscriptionStatus: "canceled" });

    await createAdminAuditLogEntry({
      clinicId,
      clinicName: clinic.name,
      action: "terminate",
      detail: "Access terminated",
      performedBy: session.email || "unknown",
    });

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
    const session = await requireSuperAdmin();

    const db = adminDb();
    const auth = adminAuth();
    // Checked in both stores, same reasoning as the staff uid collection
    // just below: a clinic created before Clinic moved to Postgres (see
    // lib/db/clinics.ts) may only exist as a Firestore doc.
    const [clinicRow, clinicSnap] = await Promise.all([
      prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true, name: true } }),
      db.collection("clinics").doc(clinicId).get(),
    ]);
    if (!clinicRow && !clinicSnap.exists) return { error: "Clinic not found." };
    const clinicName = clinicRow?.name ?? (clinicSnap.data()?.name as string | undefined) ?? clinicId;

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

    // Written after the clinic itself is gone — AdminAuditLog.clinicId is
    // deliberately not a foreign key (see prisma/schema.prisma), precisely
    // so this history survives the clinic it's about.
    await createAdminAuditLogEntry({
      clinicId,
      clinicName,
      action: "delete",
      detail: "Clinic permanently deleted",
      performedBy: session.email || "unknown",
    });

    revalidateTag(clinicCacheTag(clinicId));
    revalidatePath("/admin");
    return {};
  } catch (err) {
    console.error("Failed to delete clinic:", err);
    return { error: "Couldn't delete this clinic. Please try again." };
  }
}

/**
 * "View as" — lets a super admin see exactly what a clinic sees (their own
 * dashboard, their own data) for support, without needing their login.
 * Sets a short-lived impersonation cookie (see lib/session.ts) rather than
 * touching the clinic's own staff accounts or the admin's real Firebase
 * custom claims, so nothing about the clinic's own account list changes
 * and there's nothing to undo on the clinic's end afterward. Always lands
 * as "owner" — the point is to see everything a clinic could see, not to
 * test a specific staff member's narrower permissions.
 *
 * redirect() is called AFTER the try/catch, not inside it — Next's
 * redirect works by throwing, and this file's catch blocks don't
 * distinguish that from a real error, so throwing it inside the try would
 * get swallowed and reported as a failure instead of navigating.
 */
export async function startImpersonationAction(clinicId: string): Promise<AdminActionResult> {
  try {
    const session = await requireSuperAdmin();

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true, name: true } });
    if (!clinic) return { error: "Clinic not found." };

    startImpersonation({ clinicId, clinicName: clinic.name, role: "owner" });
    await createAdminAuditLogEntry({
      clinicId,
      clinicName: clinic.name,
      action: "impersonate",
      detail: "Started viewing as this clinic",
      performedBy: session.email || "unknown",
    });
  } catch (err) {
    console.error("Failed to start impersonation:", err);
    return { error: "Couldn't view as this clinic. Please try again." };
  }
  redirect("/dashboard");
}

/** Ends a "View as" session (components/ImpersonationBanner.tsx's "Return
 * to admin" button) and sends the admin back to the Clinics page. */
export async function stopImpersonationAction(): Promise<void> {
  const session = await getAdminSession();
  const impersonation = peekImpersonation();
  stopImpersonation();

  if (session && impersonation) {
    await createAdminAuditLogEntry({
      clinicId: impersonation.clinicId,
      clinicName: impersonation.clinicName,
      action: "impersonate",
      detail: "Stopped viewing as this clinic",
      performedBy: session.email || "unknown",
    }).catch((err) => console.error("Failed to log end of impersonation:", err));
  }

  redirect("/admin");
}
