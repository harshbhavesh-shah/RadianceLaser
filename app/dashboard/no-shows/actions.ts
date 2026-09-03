"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  createNoShowFollowUp,
  updateNoShowFollowUp,
  deleteNoShowFollowUp,
  type NoShowFollowUpInput,
} from "@/lib/db/noShowFollowUps";
import type { NoShowFollowUp } from "@/types";

// Server Actions backing FollowUpFormModal's save/delete. Same
// requireOwner() pattern as app/dashboard/settings/areaDefActions.ts.

async function requireOwner() {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  if (session.role !== "owner") throw new Error("Only the clinic owner can do this.");
  return session;
}

export async function createNoShowFollowUpAction(
  input: NoShowFollowUpInput
): Promise<{ followUp: NoShowFollowUp } | { error: string }> {
  try {
    const session = await requireOwner();
    if (!input.name.trim()) return { error: "Follow-up name is required." };
    if (!input.templateId) return { error: "Pick a message template first." };

    const followUp = await createNoShowFollowUp(session.clinicId, { ...input, name: input.name.trim() });
    revalidatePath("/dashboard/no-shows");
    return { followUp };
  } catch (err) {
    console.error("Failed to create no-show follow-up:", err);
    return { error: "Couldn't save this follow-up. Please try again." };
  }
}

export async function updateNoShowFollowUpAction(
  id: string,
  input: NoShowFollowUpInput
): Promise<{ followUp: NoShowFollowUp } | { error: string }> {
  try {
    const session = await requireOwner();
    if (!input.name.trim()) return { error: "Follow-up name is required." };
    if (!input.templateId) return { error: "Pick a message template first." };

    const followUp = await updateNoShowFollowUp(session.clinicId, id, { ...input, name: input.name.trim() });
    revalidatePath("/dashboard/no-shows");
    return { followUp };
  } catch (err) {
    console.error("Failed to update no-show follow-up:", err);
    return { error: "Couldn't save this follow-up. Please try again." };
  }
}

export async function deleteNoShowFollowUpAction(id: string): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();
    await deleteNoShowFollowUp(session.clinicId, id);
    revalidatePath("/dashboard/no-shows");
    return {};
  } catch (err) {
    console.error("Failed to delete no-show follow-up:", err);
    return { error: "Couldn't delete this follow-up. Please try again." };
  }
}
