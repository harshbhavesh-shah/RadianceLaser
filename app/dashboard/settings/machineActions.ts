"use server";

import { getSession } from "@/lib/session";
import { createMachine, updateMachine, deleteMachine, type MachineInput } from "@/lib/db/machines";

// Server Actions backing MachineFormModal's save/delete — replaces that
// component's old direct Firestore client-SDK writes now that Machine
// lives in Postgres (lib/db/machines.ts).

export async function createMachineAction(input: MachineInput): Promise<{ id: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  try {
    const id = await createMachine(session.clinicId, input);
    return { id };
  } catch (err) {
    console.error("Failed to create machine:", err);
    return { error: "Couldn't save this machine. Please try again." };
  }
}

export async function updateMachineAction(
  machineId: string,
  input: MachineInput
): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  try {
    await updateMachine(session.clinicId, machineId, input);
    return { ok: true };
  } catch (err) {
    console.error("Failed to update machine:", err);
    return { error: "Couldn't save this machine. Please try again." };
  }
}

export async function deleteMachineAction(machineId: string): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  try {
    await deleteMachine(session.clinicId, machineId);
    return { ok: true };
  } catch (err) {
    console.error("Failed to delete machine:", err);
    return { error: "Couldn't remove this machine. Please try again." };
  }
}
