"use server";

import { getSession } from "@/lib/session";
import {
  createSessionTypeDef,
  updateSessionTypeDef,
  type SessionTypeDefInput,
} from "@/lib/db/sessionTypeDefs";
import type { SessionTypeDef } from "@/types";

// Server Actions backing MachineTypeFormModal's save — replaces that
// component's old direct Firestore client-SDK writes now that
// SessionTypeDef lives in Postgres (lib/db/sessionTypeDefs.ts).

export async function createSessionTypeDefAction(
  input: SessionTypeDefInput
): Promise<{ def: SessionTypeDef } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

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
