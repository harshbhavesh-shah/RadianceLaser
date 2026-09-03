"use client";

import { useState } from "react";
import { adjustStockAction } from "@/app/dashboard/inventory/actions";
import type { InventoryItem, InventoryLogType } from "@/types";

export default function AdjustStockModal({
  item,
  type,
  onClose,
  onAdjusted,
}: {
  item: InventoryItem;
  type: InventoryLogType;
  onClose: () => void;
  onAdjusted: (item: InventoryItem) => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRestock = type === "in";
  const parsedAmount = Number(amount);

  async function handleSave() {
    if (!amount.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return setError("Enter an amount greater than zero.");
    }

    setSaving(true);
    setError(null);

    const result = await adjustStockAction(item.id, type, parsedAmount, note);
    if ("error" in result) {
      setError(result.error);
      setSaving(false);
      return;
    }
    onAdjusted(result.item);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-card">
        <h2 className="font-display text-lg font-medium text-brown-900">
          {isRestock ? "Restock" : "Use / Remove"} {item.name}
        </h2>
        <p className="mt-1 text-sm text-brown-400">
          Currently {item.quantity} {item.unit} in stock.
        </p>
        <div className="mb-5 mt-3 h-[2px] w-8 bg-gold-500" />

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">
              {isRestock ? "Amount received" : "Amount used/removed"} ({item.unit})
            </label>
            <input
              type="number"
              min={1}
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 10"
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">
              Note <span className="text-brown-400">(optional)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isRestock ? "e.g. delivery from supplier" : "e.g. expired, or used on a patient"}
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-brown-600 hover:bg-beige-200">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
          >
            {saving ? "Saving…" : isRestock ? "Add Stock" : "Remove Stock"}
          </button>
        </div>
      </div>
    </div>
  );
}
