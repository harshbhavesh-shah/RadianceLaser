"use client";

import { useState } from "react";
import InventoryList from "./InventoryList";
import RecentActivity from "./RecentActivity";
import { computeInventoryStats } from "@/lib/inventoryPage";
import type { InventoryItem, InventoryLog } from "@/types";

function formatCurrency(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

/** Owns the item list's state so the stat banner above it can recompute
 * from the same data instead of going stale the moment someone adds an
 * item or adjusts stock. The banner itself is deliberately not a row of
 * four equal boxes — one hero number (how many items, always meaningful
 * even for a clinic that's never priced anything) with the other three
 * figures grouped alongside it, smaller, so the layout has a clear focal
 * point instead of four interchangeable tiles. */
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
      <div className="rounded-xl bg-surface p-8 shadow-soft ring-1 ring-beige-300">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
          <div className="flex-shrink-0">
            <div className="text-xs font-medium uppercase tracking-wide text-brown-400">Total Items</div>
            <div className="mt-1.5 font-display text-5xl font-medium text-brown-900">{stats.totalItems}</div>
            <div className="mt-1 text-sm text-brown-400">on hand right now</div>
          </div>

          <div className="flex flex-wrap gap-x-10 gap-y-4 sm:border-l sm:border-beige-300 sm:pl-8">
            <div>
              <div className="font-display text-2xl font-medium text-brown-900">{stats.expiringSoon}</div>
              <div className="text-xs text-brown-400">Expiring within 30 days</div>
            </div>
            <div>
              <div className="font-display text-2xl font-medium text-brown-900">{stats.lowStock}</div>
              <div className="text-xs text-brown-400">At or below reorder point</div>
            </div>
            <div>
              <div className="font-display text-2xl font-medium text-gold-600">{formatCurrency(stats.totalValue)}</div>
              <div className="text-xs text-brown-400">Shelf value, priced items</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px] xl:items-start">
        <InventoryList items={items} onItemsChange={setItems} todayStr={todayStr} canEdit={canEdit} />
        <RecentActivity logs={recentLogs} itemNameById={itemNameById} />
      </div>
    </div>
  );
}
