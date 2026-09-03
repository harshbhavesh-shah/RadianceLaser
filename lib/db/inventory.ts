import "server-only";
import { prisma } from "@/lib/db/client";
import type { InventoryItem as PrismaInventoryItemRow, InventoryLog as PrismaInventoryLogRow } from "@prisma/client";
import type { InventoryItem, InventoryLog, InventoryLogType } from "@/types";

// Backs the Inventory page — perishable/consumable stock (vials, numbing
// cream, needles, gauze) tracked as a running quantity plus an append-only
// adjustment log (see InventoryLog below). Quantity only ever changes via
// adjustInventoryStock, in the same transaction as the log row that
// explains the change — there's no "just edit the number" path, so the
// log can never drift out of sync with what the item says.

function toInventoryItem(row: PrismaInventoryItemRow): InventoryItem {
  return {
    id: row.id,
    clinicId: row.clinicId,
    name: row.name,
    unit: row.unit,
    quantity: row.quantity,
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
    ...(row.category ? { category: row.category } : {}),
    ...(row.reorderThreshold !== null ? { reorderThreshold: row.reorderThreshold } : {}),
    ...(row.expiryDate ? { expiryDate: row.expiryDate } : {}),
    ...(row.batchNumber ? { batchNumber: row.batchNumber } : {}),
    ...(row.supplier ? { supplier: row.supplier } : {}),
    ...(row.costPerUnit !== null ? { costPerUnit: row.costPerUnit } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
  };
}

function toInventoryLog(row: PrismaInventoryLogRow): InventoryLog {
  return {
    id: row.id,
    clinicId: row.clinicId,
    itemId: row.itemId,
    type: row.type as InventoryLogType,
    delta: row.delta,
    actorUid: row.actorUid,
    actorName: row.actorName,
    createdAt: Number(row.createdAt),
    ...(row.note ? { note: row.note } : {}),
  };
}

export async function getClinicInventoryItems(clinicId: string): Promise<InventoryItem[]> {
  const rows = await prisma.inventoryItem.findMany({
    where: { clinicId },
    orderBy: [{ name: "asc" }],
  });
  return rows.map(toInventoryItem);
}

export interface InventoryItemInput {
  name: string;
  category?: string;
  unit: string;
  reorderThreshold?: number;
  expiryDate?: string;
  batchNumber?: string;
  supplier?: string;
  costPerUnit?: number;
  notes?: string;
}

/** Creates a new item with an initial quantity, logged as the first "in"
 * entry — every unit an item ever has traces back to a log row this way,
 * including the starting count, not just later adjustments. */
export async function createInventoryItem(
  clinicId: string,
  input: InventoryItemInput,
  initialQuantity: number,
  actorUid: string,
  actorName: string
): Promise<InventoryItem> {
  const now = BigInt(Date.now());
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryItem.create({
      data: {
        clinicId,
        name: input.name,
        unit: input.unit,
        quantity: initialQuantity,
        category: input.category ?? null,
        reorderThreshold: input.reorderThreshold ?? null,
        expiryDate: input.expiryDate ?? null,
        batchNumber: input.batchNumber ?? null,
        supplier: input.supplier ?? null,
        costPerUnit: input.costPerUnit ?? null,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      },
    });
    if (initialQuantity > 0) {
      await tx.inventoryLog.create({
        data: {
          clinicId,
          itemId: created.id,
          type: "in",
          delta: initialQuantity,
          note: "Initial stock",
          actorUid,
          actorName,
          createdAt: now,
        },
      });
    }
    return created;
  });
  return toInventoryItem(item);
}

/** Updates an item's own details — name, category, thresholds, expiry,
 * etc. Never touches quantity; that only ever moves through
 * adjustInventoryStock below. */
export async function updateInventoryItem(clinicId: string, id: string, input: InventoryItemInput): Promise<InventoryItem> {
  const existing = await prisma.inventoryItem.findUnique({ where: { id }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) throw new Error("Inventory item not found.");

  const row = await prisma.inventoryItem.update({
    where: { id },
    data: {
      name: input.name,
      unit: input.unit,
      category: input.category ?? null,
      reorderThreshold: input.reorderThreshold ?? null,
      expiryDate: input.expiryDate ?? null,
      batchNumber: input.batchNumber ?? null,
      supplier: input.supplier ?? null,
      costPerUnit: input.costPerUnit ?? null,
      notes: input.notes ?? null,
      updatedAt: BigInt(Date.now()),
    },
  });
  return toInventoryItem(row);
}

/** Deletion is safe: nothing else references an item's id, and its logs
 * cascade with it (see the schema's onDelete: Cascade) — deleting an item
 * you added by mistake shouldn't leave orphaned history behind. */
export async function deleteInventoryItem(clinicId: string, id: string): Promise<void> {
  const existing = await prisma.inventoryItem.findUnique({ where: { id }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) throw new Error("Inventory item not found.");
  await prisma.inventoryItem.delete({ where: { id } });
}

/** Restocks ("in") or uses/wastes/corrects ("out") an item's quantity,
 * recording why in the same transaction so the item's running total and
 * its audit trail can never disagree. Refuses to take an "out" adjustment
 * below zero — a shelf count can't go negative. */
export async function adjustInventoryStock(
  clinicId: string,
  itemId: string,
  type: InventoryLogType,
  delta: number,
  note: string | undefined,
  actorUid: string,
  actorName: string
): Promise<InventoryItem> {
  if (delta <= 0) throw new Error("Adjustment must be a positive amount.");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryItem.findUnique({ where: { id: itemId } });
    if (!existing || existing.clinicId !== clinicId) throw new Error("Inventory item not found.");

    const nextQuantity = type === "in" ? existing.quantity + delta : existing.quantity - delta;
    if (nextQuantity < 0) throw new Error(`Only ${existing.quantity} ${existing.unit} in stock.`);

    const now = BigInt(Date.now());
    await tx.inventoryLog.create({
      data: { clinicId, itemId, type, delta, note: note || null, actorUid, actorName, createdAt: now },
    });
    const updated = await tx.inventoryItem.update({
      where: { id: itemId },
      data: { quantity: nextQuantity, updatedAt: now },
    });
    return toInventoryItem(updated);
  });
}

/** Most recent stock adjustments across the whole clinic, newest first —
 * the Inventory page's audit-trail list. Item names are looked up by the
 * caller (see app/dashboard/inventory/page.tsx) rather than joined here,
 * since the caller already has the full item list in hand. */
export async function getRecentInventoryLogs(clinicId: string, limit = 15): Promise<InventoryLog[]> {
  const rows = await prisma.inventoryLog.findMany({
    where: { clinicId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toInventoryLog);
}
