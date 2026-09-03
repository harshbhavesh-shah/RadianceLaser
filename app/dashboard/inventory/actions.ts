"use server";

import { getSession } from "@/lib/session";
import {
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  adjustInventoryStock,
  type InventoryItemInput,
} from "@/lib/db/inventory";
import type { InventoryItem, InventoryLogType } from "@/types";

// Server Actions backing InventoryItemFormModal (add/edit/delete an item
// definition, owner-only) and AdjustStockModal (restock/use, any signed-in
// staff — see components/inventory/ for both).

async function requireOwner() {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  if (session.role !== "owner") throw new Error("Only the clinic owner can do this.");
  return session;
}

async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return session;
}

function validateInput(input: InventoryItemInput): string | null {
  if (!input.name.trim()) return "Item name is required.";
  if (!input.unit.trim()) return "Unit is required.";
  if (input.reorderThreshold !== undefined && input.reorderThreshold < 0) return "Reorder threshold can't be negative.";
  if (input.costPerUnit !== undefined && input.costPerUnit < 0) return "Cost per unit can't be negative.";
  return null;
}

export async function createInventoryItemAction(
  input: InventoryItemInput,
  initialQuantity: number
): Promise<{ item: InventoryItem } | { error: string }> {
  try {
    const session = await requireOwner();
    const validationError = validateInput(input);
    if (validationError) return { error: validationError };
    if (initialQuantity < 0) return { error: "Starting quantity can't be negative." };

    const item = await createInventoryItem(
      session.clinicId,
      { ...input, name: input.name.trim(), unit: input.unit.trim() },
      initialQuantity,
      session.uid,
      session.email ?? session.uid
    );
    return { item };
  } catch (err) {
    console.error("Failed to create inventory item:", err);
    return { error: "Couldn't save this item. Please try again." };
  }
}

export async function updateInventoryItemAction(
  id: string,
  input: InventoryItemInput
): Promise<{ item: InventoryItem } | { error: string }> {
  try {
    const session = await requireOwner();
    const validationError = validateInput(input);
    if (validationError) return { error: validationError };

    const item = await updateInventoryItem(session.clinicId, id, {
      ...input,
      name: input.name.trim(),
      unit: input.unit.trim(),
    });
    return { item };
  } catch (err) {
    console.error("Failed to update inventory item:", err);
    return { error: "Couldn't save this item. Please try again." };
  }
}

export async function deleteInventoryItemAction(id: string): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();
    await deleteInventoryItem(session.clinicId, id);
    return {};
  } catch (err) {
    console.error("Failed to delete inventory item:", err);
    return { error: "Couldn't delete this item. Please try again." };
  }
}

export async function adjustStockAction(
  itemId: string,
  type: InventoryLogType,
  delta: number,
  note: string
): Promise<{ item: InventoryItem } | { error: string }> {
  try {
    const session = await requireSession();
    if (!Number.isFinite(delta) || delta <= 0) return { error: "Enter an amount greater than zero." };

    const item = await adjustInventoryStock(
      session.clinicId,
      itemId,
      type,
      Math.round(delta),
      note.trim(),
      session.uid,
      session.email ?? session.uid
    );
    return { item };
  } catch (err) {
    console.error("Failed to adjust inventory stock:", err);
    const message = err instanceof Error && err.message.startsWith("Only ") ? err.message : "Couldn't record this adjustment. Please try again.";
    return { error: message };
  }
}
