"use client";

import { useState } from "react";
import { AlertTriangle, PackageX, Boxes, IndianRupee } from "lucide-react";
import InventoryList from "./InventoryList";
import RecentActivity from "./RecentActivity";
import { computeInventoryStats } from "@/lib/inventoryPage";
import type { InventoryItem, InventoryLog } from "@/types";

function formatCurrency(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

/** Owns the item list's state so the stat cards above it can recompute
 * from the same data instead of going stale the moment someone adds an
 * item or adjusts stock. Expiring Soon and Low Stock get their own
 * icon-tile cards (same treatment as the Dashboard's StatCards) since
 * those are the two numbers that actually call for attention; Total Items
 * and Shelf Value are real but calmer, so they sit in a smaller strip
 * alongside rather than competing for the same visual weight. */
export default function InventoryDashboard({
  initialItems,
  recentLogs,
  todayStr,
  canEdit,
}: {
  initialItems: InventoryItem[];
  recentLogs: InventoryLog[];
  todayStr: string;
  canEdit: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const stats = computeInventoryStats(items, todayStr);
  const itemNameById = Object.fromEntries(items.map((i) => [i.id, i.name]));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-beige-300 bg-surface p-5 shadow-soft">
          <div className="flex items-center gap-2 text-xs font-semibold text-brown-400">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rust-100 text-rust-700">
              <AlertTriangle size={13} />
            </span>
            Expiring Soon
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-brown-900">{stats.expiringSoon}</span>
            <span className="text-sm text-brown-400">within 30 days</span>
          </div>
        </div>

        <div className="rounded-2xl border border-beige-300 bg-surface p-5 shadow-soft">
          <div className="flex items-center gap-2 text-xs font-semibold text-brown-400">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rust-100 text-rust-700">
              <PackageX size={13} />
            </span>
            Low Stock
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-brown-900">{stats.lowStock}</span>
            <span className="text-sm text-brown-400">at or below reorder point</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl border border-beige-300 bg-surface px-5 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Boxes size={14} className="text-brown-400" />
          <span className="font-semibold text-brown-900">{stats.totalItems}</span>
          <span className="text-brown-400">items on hand</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <IndianRupee size={14} className="text-brown-400" />
          <span className="font-semibold text-brown-900">{formatCurrency(stats.totalValue)}</span>
          <span className="text-brown-400">shelf value, priced items</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px] xl:items-start">
        <InventoryList items={items} onItemsChange={setItems} todayStr={todayStr} canEdit={canEdit} />
        <RecentActivity logs={recentLogs} itemNameById={itemNameById} />
      </div>
    </div>
  );
}
