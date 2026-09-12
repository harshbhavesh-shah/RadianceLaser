"use server";

import { getSession } from "@/lib/session";
import {
  createSessionTypeDef,
  updateSessionTypeDef,
  type SessionTypeDefInput,
} from "@/lib/db/sessionTypeDefs";
import { BUILT_IN_SESSION_TYPE_CONFIG } from "@/lib/sessionTypes";
import { getClinic } from "@/lib/db/clinics";
import { getClinicTier, getEntitlements } from "@/lib/entitlements";
import type { SessionTypeDef } from "@/types";

// Server Actions backing MachineTypeFormModal's save — replaces that
// component's old direct Firestore client-SDK writes now that
// SessionTypeDef lives in Postgres (lib/db/sessionTypeDefs.ts).

export async function createSessionTypeDefAction(
  input: SessionTypeDefInput
): Promise<{ def: SessionTypeDef } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  // A built-in type (Consultation/Q-Switch/LHR) has no SessionTypeDef row
  // until it's first edited — this action is called both for that first
  // edit AND for a genuinely new custom type, keyed only by input.key.
  // Only the latter is gated (Basic+); editing the color/badge/fields of a
  // built-in type is baseline functionality at every tier.
  const isBuiltInEdit = Object.prototype.hasOwnProperty.call(BUILT_IN_SESSION_TYPE_CONFIG, input.key);
  if (!isBuiltInEdit) {
    const clinic = await getClinic(session.clinicId);
    const tier = getClinicTier(
      clinic ?? { subscriptionStatus: "active", trialEndsAt: 0, planTier: null }
    );
    if (!getEntitlements(tier).customMachineTypes) {
      return { error: "Custom machine types are available on the Basic plan and above." };
    }
  }

  try {
    const def = await createSessionTypeDef(session.clinicId, input);
    return { def };
  } catch (err) {
    console.error("Failed to create machine type:", err);
    return { error: "Couldn't save this machine type. Please try again." };
  }
}

export async function updateSessionTypeDefAction(
  id: string,
  input: Omit<SessionTypeDefInput, "key">
): Promise<{ def: SessionTypeDef } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  try {
    const def = await updateSessionTypeDef(session.clinicId, id, input);
    return { def };
  } catch (err) {
    console.error("Failed to update machine type:", err);
    return { error: "Couldn't save this machine type. Please try again." };
  }
}
