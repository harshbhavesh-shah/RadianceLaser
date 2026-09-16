"use client";

import { useState } from "react";
import { AlertTriangle, Boxes, Clock, IndianRupee, Plus } from "lucide-react";
import InventoryList from "./InventoryList";
import RecentActivity from "./RecentActivity";
import InventoryItemFormModal from "./InventoryItemFormModal";
import { computeInventoryStats } from "@/lib/inventoryPage";
import type { InventoryItem, InventoryLog } from "@/types";

function formatCurrency(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

/** Owns the item list's state so the stat cards and header can recompute
 * or add to it without going stale. The header/Add Item button and the
 * Expiring Soon / Low Stock cards mirror the Figma design's Inventory
 * screen (icon + bold label, big number, "items"); Total Items and Shelf
 * Value plus Recent Activity are real functionality the static design
 * doesn't model, kept below the Figma-matched section rather than dropped
 * — same call as keeping reception's "This Week" section on the
 * dashboard. */
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
  const [addingNew, setAddingNew] = useState(false);
  const stats = computeInventoryStats(items, todayStr);
  const itemNameById = Object.fromEntries(items.map((i) => [i.id, i.name]));

  function handleCreated(item: InventoryItem) {
    setItems((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
    setAddingNew(false);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 text-3xl font-extrabold tracking-tight text-brown-900">Inventory</h1>
        {canEdit && (
          <button
            onClick={() => setAddingNew(true)}
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-rust-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-rust-700"
          >
            <Plus size={16} strokeWidth={2.5} />
            Add Item
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-[18px] border border-beige-300 bg-surface px-6 py-5 shadow-soft">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[#D4A24C]" />
            <span className="text-sm font-bold text-brown-400">Expiring Soon</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-brown-900">{stats.expiringSoon}</span>
            <span className="text-sm font-semibold text-brown-400">items</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-[18px] border border-beige-300 bg-surface px-6 py-5 shadow-soft">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-[#E0A896]" />
            <span className="text-sm font-bold text-brown-400">Low Stock</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-brown-900">{stats.lowStock}</span>
            <span className="text-sm font-semibold text-brown-400">items</span>
          </div>
        </div>
      </div>

      <InventoryList items={items} onItemsChange={setItems} todayStr={todayStr} canEdit={canEdit} />

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

      <RecentActivity logs={recentLogs} itemNameById={itemNameById} />

      {addingNew && <InventoryItemFormModal onClose={() => setAddingNew(false)} onSaved={handleCreated} />}
    </div>
  );
}
