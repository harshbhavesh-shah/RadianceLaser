"use client";

import { useState } from "react";
import { createInventoryItemAction, updateInventoryItemAction } from "@/app/dashboard/inventory/actions";
import type { InventoryItem } from "@/types";

export default function InventoryItemFormModal({
  editing,
  onClose,
  onSaved,
}: {
  editing?: InventoryItem | null;
  onClose: () => void;
  onSaved: (item: InventoryItem) => void;
}) {
  const isEditing = !!editing;

  const [name, setName] = useState(editing?.name || "");
  const [category, setCategory] = useState(editing?.category || "");
  const [unit, setUnit] = useState(editing?.unit || "");
  const [initialQuantity, setInitialQuantity] = useState(0);
  const [reorderThreshold, setReorderThreshold] = useState(editing?.reorderThreshold?.toString() || "");
  const [expiryDate, setExpiryDate] = useState(editing?.expiryDate || "");
  const [batchNumber, setBatchNumber] = useState(editing?.batchNumber || "");
  const [supplier, setSupplier] = useState(editing?.supplier || "");
  const [costPerUnit, setCostPerUnit] = useState(editing?.costPerUnit?.toString() || "");
  const [notes, setNotes] = useState(editing?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmedName = name.trim();
    const trimmedUnit = unit.trim();
    if (!trimmedName) return setError("Item name is required.");
    if (!trimmedUnit) return setError("Unit is required (e.g. vials, boxes, ml).");

    setSaving(true);
    setError(null);

    const fields = {
      name: trimmedName,
      unit: trimmedUnit,
      category: category.trim() || undefined,
      reorderThreshold: reorderThreshold.trim() ? Number(reorderThreshold) : undefined,
      expiryDate: expiryDate || undefined,
      batchNumber: batchNumber.trim() || undefined,
      supplier: supplier.trim() || undefined,
      costPerUnit: costPerUnit.trim() ? Number(costPerUnit) : undefined,
      notes: notes.trim() || undefined,
    };

    try {
      const result =
        isEditing && editing
          ? await updateInventoryItemAction(editing.id, fields)
          : await createInventoryItemAction(fields, Math.max(0, Math.round(initialQuantity)));
      if ("error" in result) {
        setError(result.error);
        setSaving(false);
        return;
      }
      onSaved(result.item);
    } catch (err) {
      console.error("Failed to save inventory item:", err);
      setError("Couldn't save this item. Please try again.");
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-surface p-6 shadow-card">
        <h2 className="font-display text-lg font-medium text-brown-900">
          {isEditing ? `Edit ${editing!.name}` : "New Inventory Item"}
        </h2>
        <p className="mt-1 text-sm text-brown-400">
          {isEditing
            ? "Quantity itself is changed from Restock / Use on the item's row, not here."
            : "Set the starting quantity here — after that, use Restock / Use on the item's row."}
        </p>
        <div className="mb-5 mt-3 h-[2px] w-8 bg-gold-500" />

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-brown-700">Item Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Botox 100u vial"
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Injectable"
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">Unit</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. vials"
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>
          </div>

          {!isEditing && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">Starting Quantity</label>
              <input
                type="number"
                min={0}
                value={initialQuantity}
                onChange={(e) => setInitialQuantity(Number(e.target.value))}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">
                Reorder At <span className="text-brown-400">(optional)</span>
              </label>
              <input
                type="number"
                min={0}
                value={reorderThreshold}
                onChange={(e) => setReorderThreshold(e.target.value)}
                placeholder="e.g. 5"
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">
                Expiry Date <span className="text-brown-400">(optional)</span>
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">
                Batch/Lot No. <span className="text-brown-400">(optional)</span>
              </label>
              <input
                type="text"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">
                Cost/Unit (₹) <span className="text-brown-400">(optional)</span>
              </label>
              <input
                type="number"
                min={0}
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(e.target.value)}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">
              Supplier <span className="text-brown-400">(optional)</span>
            </label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">
              Notes <span className="text-brown-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
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
            {saving ? "Saving…" : isEditing ? "Save Changes" : "Add Item"}
          </button>
        </div>
      </div>
    </div>
  );
}
