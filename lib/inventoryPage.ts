// No "server-only" here — isExpired/isExpiringSoon/isLowStock are used
// from InventoryList, a Client Component, for the same badges the server
// already computed stats from. Pure functions, no secrets, safe either side.
import { todayLocalStr } from "@/lib/calendar";
import type { InventoryItem } from "@/types";

// How far ahead "expiring soon" looks — generous on purpose, since
// reordering a perishable (a filler/Botox batch, numbing cream) usually
// takes longer than reordering an everyday consumable.
const EXPIRY_WARNING_DAYS = 30;

function warningCutoffStr(todayStr: string): string {
  const cutoff = new Date(`${todayStr}T00:00:00`);
  cutoff.setDate(cutoff.getDate() + EXPIRY_WARNING_DAYS);
  return `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
}

export function isExpired(item: InventoryItem, todayStr: string = todayLocalStr()): boolean {
  return !!item.expiryDate && item.expiryDate < todayStr;
}

export function isExpiringSoon(item: InventoryItem, todayStr: string = todayLocalStr()): boolean {
  return !!item.expiryDate && item.expiryDate >= todayStr && item.expiryDate <= warningCutoffStr(todayStr);
}

export function isLowStock(item: InventoryItem): boolean {
  return item.reorderThreshold !== undefined && item.quantity <= item.reorderThreshold;
}

export interface InventoryStats {
  totalItems: number;
  expiringSoon: number;
  lowStock: number;
  totalValue: number;
}

/** The Inventory page's stat strip: how many items total, how many need
 * attention (expiring or low), and what's on the shelf worth (only counts
 * items with a cost per unit set — silently skips the rest rather than
 * treating an unpriced item as worth zero). */
export function computeInventoryStats(items: InventoryItem[], todayStr: string = todayLocalStr()): InventoryStats {
  let expiringSoon = 0;
  let lowStock = 0;
  let totalValue = 0;

  for (const item of items) {
    if (isExpired(item, todayStr) || isExpiringSoon(item, todayStr)) expiringSoon++;
    if (isLowStock(item)) lowStock++;
    if (item.costPerUnit) totalValue += item.costPerUnit * item.quantity;
  }

  return { totalItems: items.length, expiringSoon, lowStock, totalValue };
}
