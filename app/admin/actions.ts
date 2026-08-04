"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getAdminSession } from "@/lib/session";
import { adminDb } from "@/lib/firebase/admin";
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
