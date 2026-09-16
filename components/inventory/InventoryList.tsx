"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  Clock,
  PackageMinus,
  PackagePlus,
  Trash2,
} from "lucide-react";
import InventoryItemFormModal from "./InventoryItemFormModal";
import AdjustStockModal from "./AdjustStockModal";
import { deleteInventoryItemAction } from "@/app/dashboard/inventory/actions";
import { isExpired, isExpiringSoon, isLowStock } from "@/lib/inventoryPage";
import EmptyState from "@/components/ui/EmptyState";
import type { InventoryItem, InventoryLogType } from "@/types";

type AdjustState = { item: InventoryItem; type: InventoryLogType } | null;

/** The item list itself — each item its own card (name, category, Stock
 * Level / Expiry Date metrics, actions), matching the Figma design's
 * per-item card treatment. Restock/Use/Edit/Delete stay real actions
 * (the design's mock only shows one canned action per item) since the
 * app tracks a real running quantity, not a static "low/ok" flag. */
export default function InventoryList({
  items,
  onItemsChange,
  todayStr,
  canEdit,
}: {
  items: InventoryItem[];
  onItemsChange: (updater: (prev: InventoryItem[]) => InventoryItem[]) => void;
  todayStr: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [adjusting, setAdjusting] = useState<AdjustState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  function handleSaved(item: InventoryItem) {
    onItemsChange((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      const next = exists ? prev.map((i) => (i.id === item.id ? item : i)) : [...prev, item];
      return [...next].sort((a, b) => a.name.localeCompare(b.name));
    });
    setEditing(null);
  }

  function handleAdjusted(item: InventoryItem) {
    onItemsChange((prev) => prev.map((i) => (i.id === item.id ? item : i)));
    setAdjusting(null);
  }

  async function handleDelete(item: InventoryItem) {
    if (!confirm(`Remove "${item.name}" from inventory? This can't be undone.`)) return;
    setDeletingId(item.id);
    const result = await deleteInventoryItemAction(item.id);
    if (result.error) {
      alert(result.error);
    } else {
      onItemsChange((prev) => prev.filter((i) => i.id !== item.id));
    }
    setDeletingId(null);
  }

  const categories = [...new Set(items.map((i) => i.category).filter((c): c is string => !!c))].sort();
  const filters = [
    { key: "all", label: "All" },
    { key: "expiring", label: "Expiring Soon" },
    { key: "low", label: "Low Stock" },
    ...categories.map((c) => ({ key: `category:${c}`, label: c })),
  ];
  const filteredItems = items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "expiring") return isExpired(item, todayStr) || isExpiringSoon(item, todayStr);
    if (filter === "low") return isLowStock(item);
    if (filter.startsWith("category:")) return item.category === filter.slice("category:".length);
    return true;
  });

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Boxes}
        title="No inventory items yet."
        description="Add numbing cream, filler vials, needles, or anything else with a shelf life or a reorder point."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-3">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
              filter === f.key
                ? "border-rust-600 bg-rust-600 text-white shadow-sm"
                : "border-beige-300 bg-surface text-brown-400 hover:bg-beige-200/50 hover:text-brown-900"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <p className="text-sm text-brown-400">No items match this filter.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredItems.map((item) => {
            const expired = isExpired(item, todayStr);
            const expiringSoon = !expired && isExpiringSoon(item, todayStr);
            const lowStock = isLowStock(item);

            return (
              <div
                key={item.id}
                className="flex flex-col gap-6 rounded-[18px] border border-beige-300 bg-surface p-6 shadow-soft transition-colors hover:border-beige-300/80 md:flex-row md:items-center md:justify-between"
              >
                {/* Item Info */}
                <button
                  onClick={() => canEdit && setEditing(item)}
                  disabled={!canEdit}
                  className="min-w-0 flex-1 text-left enabled:cursor-pointer"
                >
                  <h3 className="text-lg font-extrabold leading-tight text-brown-900">{item.name}</h3>
                  {item.category && (
                    <span className="mt-2.5 inline-flex items-center rounded-full border border-beige-300/50 bg-beige-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brown-400">
                      {item.category}
                    </span>
                  )}
                </button>

                {/* Metrics */}
                <div className="flex flex-wrap items-start gap-8 md:flex-nowrap md:items-center md:gap-16">
                  <div className="flex min-w-[120px] flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brown-400">
                      Stock Level
                    </span>
                    {lowStock ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#E0A896]">
                        <AlertTriangle size={16} strokeWidth={2.5} />
                        {item.quantity} {item.unit}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-brown-900">
                        {item.quantity} {item.unit}
                      </span>
                    )}
                  </div>

                  <div className="flex min-w-[140px] flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brown-400">
                      Expiry Date
                    </span>
                    {expired ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#E0A896]">
                        <AlertCircle size={16} strokeWidth={2.5} />
                        {item.expiryDate}
                      </span>
                    ) : expiringSoon ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#D4A24C]">
                        <Clock size={16} strokeWidth={2.5} />
                        {item.expiryDate}
                      </span>
                    ) : (
                      <span className="text-sm font-extrabold text-brown-400">{item.expiryDate || "N/A"}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-2 flex shrink-0 items-center gap-2 md:mt-0 md:justify-end">
                  <button
                    onClick={() => setAdjusting({ item, type: "in" })}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-beige-300 px-4 py-2 text-sm font-bold text-brown-900 transition-colors hover:border-brown-900/20 hover:bg-beige-200/50"
                  >
                    <PackagePlus size={16} strokeWidth={2.5} />
                    Restock
                  </button>
                  <button
                    onClick={() => setAdjusting({ item, type: "out" })}
                    disabled={item.quantity <= 0}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-beige-300 px-4 py-2 text-sm font-bold text-brown-900 transition-colors hover:border-brown-900/20 hover:bg-beige-200/50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PackageMinus size={16} strokeWidth={2.5} />
                    Use
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      className="rounded-xl p-2 text-brown-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && <InventoryItemFormModal editing={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />}
      {adjusting && (
        <AdjustStockModal
          item={adjusting.item}
          type={adjusting.type}
          onClose={() => setAdjusting(null)}
          onAdjusted={handleAdjusted}
        />
      )}
    </div>
  );
}
