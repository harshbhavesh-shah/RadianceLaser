"use client";

import { useState } from "react";
import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import { todayLocalStr } from "@/lib/packages";
import type { Package, SessionType } from "@/types";

export default function PackageFormModal({
  clinicId,
  patientId,
  sessionType,
  onClose,
  onCreated,
}: {
  clinicId: string;
  patientId: string;
  sessionType: SessionType;
  onClose: () => void;
  onCreated: (pkg: Package) => void;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const config = SESSION_TYPE_CONFIG[sessionType];

  const [label, setLabel] = useState(`${config.label} Package`);
  const [totalSessions, setTotalSessions] = useState("10");
  const [totalAmount, setTotalAmount] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayLocalStr());
  const [expiryDate, setExpiryDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const sessions = Number(totalSessions);
    const amount = Number(totalAmount);

    if (!sessions || sessions <= 0) return setError("Enter a valid number of sessions.");
    if (!amount || amount <= 0) return setError("Enter a valid total amount.");

    setSaving(true);
    setError(null);

    try {
      const docRef = await addDoc(collection(db, "packages"), {
        clinicId,
        patientId,
        sessionType,
        label: label.trim() || config.label,
        totalSessions: sessions,
        totalAmount: amount,
        purchaseDate,
        ...(expiryDate ? { expiryDate } : {}),
        createdAt: Date.now(),
      });

      onCreated({
        id: docRef.id,
        clinicId,
        patientId,
        sessionType,
        label: label.trim() || config.label,
        totalSessions: sessions,
        totalAmount: amount,
        purchaseDate,
        ...(expiryDate ? { expiryDate } : {}),
        createdAt: Date.now(),
      });
    } catch (err) {
      console.error("Failed to create package:", err);
      setError("Couldn't save this package. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${config.badgeClassName}`}
          >
            {config.badgeText}
          </span>
          <h2 className="font-display text-lg font-medium text-brown-900">New Package</h2>
        </div>
        <div className="mb-5 h-[2px] w-8 bg-gold-500" />

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">Package Name</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">
                Total Sessions
              </label>
              <input
                type="number"
                min={1}
                value={totalSessions}
                onChange={(e) => setTotalSessions(e.target.value)}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">
                Total Amount (₹)
              </label>
              <input
                type="number"
                min={0}
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="e.g. 15000"
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>
          </div>

          {totalSessions && totalAmount && Number(totalSessions) > 0 && (
            <p className="text-xs text-brown-400">
              ₹{Math.round(Number(totalAmount) / Number(totalSessions)).toLocaleString("en-IN")} per
              session
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">
                Purchase Date
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
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
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
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
            {saving ? "Saving…" : "Create Package"}
          </button>
        </div>
      </div>
    </div>
  );
}
