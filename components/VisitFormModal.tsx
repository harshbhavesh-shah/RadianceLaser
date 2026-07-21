"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, deleteField, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { SESSION_TYPE_CONFIG, NUMERIC_FIELD_KEYS } from "@/lib/sessionTypes";
import type { Package, SessionType, Visit } from "@/types";

function todayLocalStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function VisitFormModal({
  clinicId,
  patientId,
  sessionType,
  visit,
  activePackages = [],
  presetPackageId,
  onClose,
  onSaved,
  onDeleted,
}: {
  clinicId: string;
  patientId: string;
  sessionType: SessionType;
  visit?: Visit | null; // omit/null = creating a new visit; pass one = editing
  activePackages?: Package[]; // packages with sessions remaining, matching this sessionType
  presetPackageId?: string; // pre-select a package, e.g. opened via "Redeem Session"
  onClose: () => void;
  onSaved: (visit: Visit) => void;
  onDeleted?: (visitId: string) => void;
}) {
  const config = SESSION_TYPE_CONFIG[sessionType];
  const isEditing = !!visit;

  const [date, setDate] = useState(visit?.date || "");
  const [packageId, setPackageId] = useState(visit?.packageId || presetPackageId || "");
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const col of config.columns) {
      const v = visit?.fields?.[col.key];
      initial[col.key] = v === undefined || v === null ? "" : String(v);
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPackage = activePackages.find((p) => p.id === packageId);

  function updateField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function handlePackageChange(value: string) {
    setPackageId(value);
    // Covered by the package — no separate charge, otherwise it'd double
    // count against the package purchase's own revenue.
    if (value) updateField("fee", "0");
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const parsedFields: Record<string, string | number> = {};
    for (const col of config.columns) {
      const raw = fields[col.key];
      if (raw === "") continue;
      parsedFields[col.key] = NUMERIC_FIELD_KEYS.has(col.key) ? Number(raw) : raw;
    }

    try {
      if (isEditing && visit) {
        const updatePayload: Record<string, unknown> = { date, fields: parsedFields };
        // Firestore rejects `undefined` field values — clearing a package
        // link (switching back to "None") needs an explicit deleteField(),
        // otherwise the stale packageId would silently stay on the document.
        updatePayload.packageId = packageId ? packageId : deleteField();
        await updateDoc(doc(db, "visits", visit.id), updatePayload);
        onSaved({ ...visit, date, fields: parsedFields, packageId: packageId || undefined });
      } else {
        const createPayload = {
          clinicId,
          patientId,
          sessionType,
          date,
          fields: parsedFields,
          ...(packageId ? { packageId } : {}),
          createdAt: Date.now(),
        };
        const docRef = await addDoc(collection(db, "visits"), createPayload);
        onSaved({ id: docRef.id, ...createPayload });
      }
    } catch (err) {
      console.error("Failed to save visit:", err);
      const code = (err as { code?: string })?.code;
      setError(
        code === "permission-denied"
          ? "You don't have permission to save this. Check that Firestore rules are deployed and try signing in again."
          : `Couldn't save (${code || "unknown error"}). Please try again.`
      );
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!visit) return;
    if (!confirm("Delete this visit? This can't be undone.")) return;

    setDeleting(true);
    try {
      await deleteDoc(doc(db, "visits", visit.id));
      onDeleted?.(visit.id);
    } catch (err) {
      console.error("Failed to delete visit:", err);
      setError("Couldn't delete this visit. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-surface p-6 shadow-card">
        <div className="mb-1 flex items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${config.badgeClassName}`}
          >
            {config.badgeText}
          </span>
          <h2 className="font-display text-lg font-medium text-brown-900">
            {isEditing ? "Edit Visit" : "Log New Visit"}
          </h2>
        </div>
        <div className="mb-5 h-[2px] w-8 bg-gold-500" />

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-brown-700">Date</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
            <button
              type="button"
              onClick={() => setDate(todayLocalStr())}
              className="flex-shrink-0 rounded-md border border-beige-300 px-3 py-2 text-sm font-medium text-brown-600 transition-colors hover:border-gold-500 hover:text-gold-600"
            >
              Today
            </button>
          </div>
        </div>

        {activePackages.length > 0 && (
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-brown-700">Package</label>
            <select
              value={packageId}
              onChange={(e) => handlePackageChange(e.target.value)}
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            >
              <option value="">None — pay per visit</option>
              {activePackages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.label}
                </option>
              ))}
            </select>
            {selectedPackage && (
              <p className="mt-1.5 text-xs text-gold-600">
                Covered by {selectedPackage.label} — no separate fee for this visit.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {config.columns.map((col) => {
            const isFeeLockedByPackage = col.key === "fee" && !!packageId;
            return (
              <div key={col.key}>
                <label className="mb-1.5 block text-sm font-medium text-brown-700">{col.label}</label>
                {col.type === "select" ? (
                  <select
                    value={fields[col.key]}
                    onChange={(e) => updateField(col.key, e.target.value)}
                    className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                  >
                    <option value="">— Select —</option>
                    {col.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={col.type === "number" ? "number" : "text"}
                    value={fields[col.key]}
                    onChange={(e) => updateField(col.key, e.target.value)}
                    disabled={isFeeLockedByPackage}
                    className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500 disabled:bg-beige-200 disabled:text-brown-400"
                  />
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          <div>
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-sm font-medium text-red-700 hover:underline disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete Visit"}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-brown-600 hover:bg-beige-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Visit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}