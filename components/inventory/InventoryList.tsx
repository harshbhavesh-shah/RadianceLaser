"use client";

import { useState } from "react";
import { Trash2, PackagePlus, PackageMinus, Boxes } from "lucide-react";
import InventoryItemFormModal from "./InventoryItemFormModal";
import AdjustStockModal from "./AdjustStockModal";
import { deleteInventoryItemAction } from "@/app/dashboard/inventory/actions";
import { isExpired, isExpiringSoon, isLowStock } from "@/lib/inventoryPage";
import EmptyState from "@/components/ui/EmptyState";
import type { InventoryItem, InventoryLogType } from "@/types";

type AdjustState = { item: InventoryItem; type: InventoryLogType } | null;

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
  const [editing, setEditing] = useState<InventoryItem | null | "new">(null);
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

  const editingItem = editing && editing !== "new" ? editing : null;

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

  return (
    <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-brown-900">Inventory</h2>
          <p className="mt-0.5 text-xs text-brown-400">
            Every consumable and perishable the clinic keeps on hand. Restock or use is open to
            anyone signed in; adding, editing, or removing an item stays owner-only.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setEditing("new")}
            className="flex-shrink-0 rounded-lg bg-rust-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rust-700"
          >
            + New Item
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            compact
            icon={Boxes}
            title="No inventory items yet."
            description="Add numbing cream, filler vials, needles, or anything else with a shelf life or a reorder point."
          />
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === f.key
                    ? "bg-rust-600 text-white"
                    : "bg-beige-200 text-brown-600 hover:bg-beige-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredItems.length === 0 ? (
            <p className="mt-4 text-sm text-brown-400">No items match this filter.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {filteredItems.map((item) => {
            const expired = isExpired(item, todayStr);
            const expiringSoon = !expired && isExpiringSoon(item, todayStr);
            const lowStock = isLowStock(item);

            return (
              <div key={item.id} className="rounded-lg border border-beige-300 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    onClick={() => canEdit && setEditing(item)}
                    disabled={!canEdit}
                    className="min-w-0 flex-1 text-left enabled:cursor-pointer"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-brown-900">{item.name}</span>
                      {item.category && (
                        <span className="rounded-full bg-beige-200 px-2 py-0.5 text-[10px] font-semibold text-brown-600">
                          {item.category}
                        </span>
                      )}
                      {expired && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                          Expired
                        </span>
                      )}
                      {expiringSoon && (
                        <span className="rounded-full bg-rust-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rust-700">
                          Expiring Soon
                        </span>
                      )}
                      {lowStock && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                          Low Stock
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-brown-500">
                      <span className="font-medium text-brown-700">
                        {item.quantity} {item.unit}
                      </span>
                      {item.reorderThreshold !== undefined && ` · reorder at ${item.reorderThreshold}`}
                      {item.expiryDate && ` · expires ${item.expiryDate}`}
                      {item.batchNumber && ` · batch ${item.batchNumber}`}
                      {item.supplier && ` · ${item.supplier}`}
                    </p>
                  </button>

                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => setAdjusting({ item, type: "in" })}
                      className="flex items-center gap-1 rounded-full border border-rust-600 px-2.5 py-1 text-[11px] font-medium text-rust-700 transition-colors hover:bg-rust-100"
                    >
                      <PackagePlus size={12} /> Restock
                    </button>
                    <button
                      onClick={() => setAdjusting({ item, type: "out" })}
                      disabled={item.quantity <= 0}
                      className="flex items-center gap-1 rounded-full border border-beige-300 px-2.5 py-1 text-[11px] font-medium text-brown-600 transition-colors hover:bg-beige-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <PackageMinus size={12} /> Use
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        className="rounded p-1.5 text-brown-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
              })}
            </div>
          )}
        </>
      )}

      {editing === "new" && <InventoryItemFormModal onClose={() => setEditing(null)} onSaved={handleSaved} />}
      {editingItem && (
        <InventoryItemFormModal editing={editingItem} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
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
