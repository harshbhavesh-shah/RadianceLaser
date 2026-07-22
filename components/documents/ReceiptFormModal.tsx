"use client";

import { useMemo, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase/client";
import { allocateReceiptNumber } from "@/lib/receiptNumber";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import type { Patient, Package, Receipt, ReceiptItem, Visit } from "@/types";

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReceiptFormModal({
  clinicId,
  patient,
  visits,
  packages,
  currentUid,
  currentName,
  onClose,
  onCreated,
}: {
  clinicId: string;
  patient: Patient;
  visits: Visit[]; // this patient's visits only
  packages: Package[]; // this patient's packages only
  currentUid: string;
  currentName: string;
  onClose: () => void;
  onCreated: (receipt: Receipt) => void;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [date, setDate] = useState(todayISO());
  const [consultingDoctor, setConsultingDoctor] = useState(currentName);
  const [notes, setNotes] = useState("");
  const [sourceVisitId, setSourceVisitId] = useState<string | undefined>();
  const [sourcePackageId, setSourcePackageId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedVisits = useMemo(
    () =>
      [...visits]
        .filter((v) => typeof v.fields?.fee === "number" && v.fields.fee > 0 && !v.packageId)
        .sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.createdAt - a.createdAt)
        .slice(0, 8),
    [visits]
  );

  const total = items.reduce(
    (sum, it) => sum + ((Number(it.amount) || 0) - (Number(it.discount) || 0)),
    0
  );

  function addVisitLine(v: Visit) {
    const label = SESSION_TYPE_CONFIG[v.sessionType]?.label || v.sessionType;
    const area = typeof v.fields.area === "string" ? v.fields.area : undefined;
    const desc = `${label}${area ? ` — ${area}` : ""} (${v.date || "undated"})`;
    setItems((prev) => [...prev, { description: desc, amount: Number(v.fields.fee) || 0, discount: 0 }]);
    setSourceVisitId(v.id);
    setSourcePackageId(undefined);
  }

  function addPackageLine(p: Package) {
    setItems((prev) => [...prev, { description: `Package: ${p.label}`, amount: p.totalAmount, discount: 0 }]);
    setSourcePackageId(p.id);
    setSourceVisitId(undefined);
  }

  function addCustomLine() {
    setItems((prev) => [...prev, { description: "", amount: 0, discount: 0 }]);
    setSourceVisitId(undefined);
    setSourcePackageId(undefined);
  }

  function updateItem(i: number, patch: Partial<ReceiptItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    const cleaned = items
      .map((it) => ({
        description: it.description.trim(),
        amount: Number(it.amount) || 0,
        discount: Number(it.discount) || 0,
      }))
      .filter((it) => it.description);
    if (cleaned.length === 0) return setError("Add at least one line item.");
    if (!date) return setError("Choose a date.");

    setSaving(true);
    setError(null);

    try {
      const receiptNumber = await allocateReceiptNumber(clinicId);
      const id = crypto.randomUUID();
      const amount = cleaned.reduce((sum, it) => sum + (it.amount - it.discount), 0);
      const payload = {
        clinicId,
        patientId: patient.id,
        patientName: patient.name,
        ...(patient.phone ? { patientPhone: patient.phone } : {}),
        ...(patient.age !== undefined ? { patientAge: patient.age } : {}),
        ...(patient.gender ? { patientGender: patient.gender } : {}),
        ...(patient.address ? { patientAddress: patient.address } : {}),
        ...(consultingDoctor.trim() ? { consultingDoctor: consultingDoctor.trim() } : {}),
        receiptNumber,
        date,
        items: cleaned,
        amount,
        ...(sourceVisitId ? { visitId: sourceVisitId } : {}),
        ...(sourcePackageId ? { packageId: sourcePackageId } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        issuedByUid: currentUid,
        issuedByName: currentName,
        createdAt: Date.now(),
      };
      await setDoc(doc(db, "receipts", id), payload);
      onCreated({ id, ...payload });
    } catch (err) {
      console.error("Failed to save receipt:", err);
      const code = (err as { code?: string })?.code;
      setError(
        code === "permission-denied"
          ? "You don't have permission to save this. Check that Firestore rules are deployed and try signing in again."
          : "Couldn't save this receipt. Please try again."
      );
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-surface p-6 shadow-card">
        <h2 className="font-display text-lg font-medium text-brown-900">New Receipt — {patient.name}</h2>
        <p className="mt-1 text-sm text-brown-400">
          Pick a session or package to auto-fill a line, or add a custom line for anything else.
        </p>
        <div className="mb-5 mt-3 h-[2px] w-8 bg-gold-500" />

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">
                Consulting Doctor <span className="text-brown-400">(optional)</span>
              </label>
              <input
                type="text"
                value={consultingDoctor}
                onChange={(e) => setConsultingDoctor(e.target.value)}
                placeholder="e.g. Dr. Bhavesh Shah"
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>
          </div>

          {(sortedVisits.length > 0 || packages.length > 0) && (
            <div>
              <div className="mb-1.5 text-sm font-medium text-brown-700">Quick add</div>
              <div className="flex flex-wrap gap-1.5">
                {sortedVisits.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => addVisitLine(v)}
                    className="rounded-full bg-beige-200 px-2.5 py-1 text-xs font-medium text-brown-600 transition-colors hover:bg-gold-100 hover:text-gold-600"
                  >
                    {SESSION_TYPE_CONFIG[v.sessionType]?.label || v.sessionType} · {v.date || "undated"} ·{" "}
                    {formatCurrency(Number(v.fields.fee) || 0)}
                  </button>
                ))}
                {packages.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addPackageLine(p)}
                    className="rounded-full bg-beige-200 px-2.5 py-1 text-xs font-medium text-brown-600 transition-colors hover:bg-gold-100 hover:text-gold-600"
                  >
                    {p.label} · {formatCurrency(p.totalAmount)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-sm font-medium text-brown-700">Line Items</label>
              <button
                type="button"
                onClick={addCustomLine}
                className="flex items-center gap-1 text-xs font-medium text-gold-600 hover:underline"
              >
                <Plus size={14} /> Add custom line
              </button>
            </div>

            {items.length === 0 ? (
              <p className="rounded-md border border-dashed border-beige-300 px-3 py-4 text-center text-sm text-brown-400">
                No line items yet.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="hidden grid-cols-[1fr_88px_88px_32px] gap-2 px-0.5 text-xs font-medium uppercase tracking-wide text-brown-400 sm:grid">
                  <span>Description</span>
                  <span>Price</span>
                  <span>Discount</span>
                  <span />
                </div>
                {items.map((it, i) => (
                  <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_88px_88px_32px]">
                    <input
                      type="text"
                      value={it.description}
                      onChange={(e) => updateItem(i, { description: e.target.value })}
                      placeholder="Description"
                      className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                    />
                    <input
                      type="number"
                      value={it.amount}
                      onChange={(e) => updateItem(i, { amount: Number(e.target.value) })}
                      placeholder="Price"
                      className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                    />
                    <input
                      type="number"
                      value={it.discount || 0}
                      onChange={(e) => updateItem(i, { discount: Number(e.target.value) })}
                      placeholder="Discount"
                      className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="flex flex-shrink-0 items-center justify-center rounded-md p-2 text-brown-400 hover:bg-beige-200 hover:text-red-700"
                      aria-label="Remove line"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex justify-end border-t border-beige-300 pt-3 text-sm">
              <span className="font-medium text-brown-600">Total:&nbsp;</span>
              <span className="font-display text-base font-medium text-brown-900">{formatCurrency(total)}</span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">
              Notes <span className="text-brown-400">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paid by card"
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm font-medium text-brown-600 hover:bg-beige-200 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Generate Receipt"}
          </button>
        </div>
      </div>
    </div>
  );
}
