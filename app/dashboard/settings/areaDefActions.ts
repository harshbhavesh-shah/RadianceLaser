"use server";

import { getSession } from "@/lib/session";
import { createAreaDef, updateAreaDef, deleteAreaDef, type AreaDefInput } from "@/lib/db/areaDefs";
import type { AreaDef } from "@/types";

// Server Actions backing AreaFormModal's save/delete — see
// components/settings/AreaFormModal.tsx and AreaDefsSection.tsx.

async function requireOwner() {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  if (session.role !== "owner") throw new Error("Only the clinic owner can do this.");
  return session;
}

export async function createAreaDefAction(input: AreaDefInput): Promise<{ def: AreaDef } | { error: string }> {
  try {
    const session = await requireOwner();
    if (!input.name.trim()) return { error: "Area name is required." };

    const def = await createAreaDef(session.clinicId, { ...input, name: input.name.trim() });
    return { def };
  } catch (err) {
    console.error("Failed to create treatment area:", err);
    return { error: "Couldn't save this treatment area. Please try again." };
  }
}

export async function updateAreaDefAction(
  id: string,
  input: Omit<AreaDefInput, "sessionType">
): Promise<{ def: AreaDef } | { error: string }> {
  try {
    const session = await requireOwner();
    if (!input.name.trim()) return { error: "Area name is required." };

    const def = await updateAreaDef(session.clinicId, id, { ...input, name: input.name.trim() });
    return { def };
  } catch (err) {
    console.error("Failed to update treatment area:", err);
    return { error: "Couldn't save this treatment area. Please try again." };
  }
}

export async function deleteAreaDefAction(id: string): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();
    await deleteAreaDef(session.clinicId, id);
    return {};
  } catch (err) {
    console.error("Failed to delete treatment area:", err);
    return { error: "Couldn't delete this treatment area. Please try again." };
  }
}
