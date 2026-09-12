"use server";

import { getSession } from "@/lib/session";
import {
  createPackageTypeDef,
  updatePackageTypeDef,
  deletePackageTypeDef,
  type PackageTypeDefInput,
} from "@/lib/db/packageTypeDefs";
import { getClinic } from "@/lib/db/clinics";
import { getClinicTier, getEntitlements } from "@/lib/entitlements";
import type { PackageTypeDef } from "@/types";

// Server Actions backing PackageTypeFormModal's save/delete — see
// components/packages/PackageTypesManager.tsx.

async function requireOwner() {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  if (session.role !== "owner") throw new Error("Only the clinic owner can do this.");
  return session;
}

export async function createPackageTypeDefAction(
  input: PackageTypeDefInput
): Promise<{ def: PackageTypeDef } | { error: string }> {
  try {
    const session = await requireOwner();

    const clinic = await getClinic(session.clinicId);
    const tier = getClinicTier(
      clinic ?? { subscriptionStatus: "active", trialEndsAt: 0, planTier: null }
    );
    if (!getEntitlements(tier).customPackageTypes) {
      return { error: "Custom package types are available on the Standard plan and above." };
    }

    if (!input.name.trim()) return { error: "Package name is required." };
    if (!input.totalSessions || input.totalSessions <= 0) return { error: "Enter a valid number of sessions." };
    if (!input.suggestedAmount || input.suggestedAmount <= 0) return { error: "Enter a valid suggested price." };

    const def = await createPackageTypeDef(session.clinicId, { ...input, name: input.name.trim() });
    return { def };
  } catch (err) {
    console.error("Failed to create package type:", err);
    return { error: "Couldn't save this package type. Please try again." };
  }
}

export async function updatePackageTypeDefAction(
  id: string,
  input: Omit<PackageTypeDefInput, "sessionType">
): Promise<{ def: PackageTypeDef } | { error: string }> {
  try {
    const session = await requireOwner();
    if (!input.name.trim()) return { error: "Package name is required." };
    if (!input.totalSessions || input.totalSessions <= 0) return { error: "Enter a valid number of sessions." };
    if (!input.suggestedAmount || input.suggestedAmount <= 0) return { error: "Enter a valid suggested price." };

    const def = await updatePackageTypeDef(session.clinicId, id, { ...input, name: input.name.trim() });
    return { def };
  } catch (err) {
    console.error("Failed to update package type:", err);
    return { error: "Couldn't save this package type. Please try again." };
  }
}

export async function deletePackageTypeDefAction(id: string): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();
    await deletePackageTypeDef(session.clinicId, id);
    return {};
  } catch (err) {
    console.error("Failed to delete package type:", err);
    return { error: "Couldn't delete this package type. Please try again." };
  }
}
