"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import type { Machine, MachineStatus, SessionType } from "@/types";

const STATUS_OPTIONS: { value: MachineStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "maintenance", label: "In Maintenance" },
  { value: "retired", label: "Retired" },
];

export default function MachineFormModal({
  clinicId,
  machine,
  onClose,
  onSaved,
  onDeleted,
}: {
  clinicId: string;
  machine?: Machine | null;
  onClose: () => void;
  onSaved: (machine: Machine) => void;
  onDeleted?: (id: string) => void;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const isEditing = !!machine;

  const [name, setName] = useState(machine?.name || "");
  const [sessionType, setSessionType] = useState<SessionType>(machine?.sessionType || "qs");
  const [serialNumber, setSerialNumber] = useState(machine?.serialNumber || "");
  const [purchaseDate, setPurchaseDate] = useState(machine?.purchaseDate || "");
  const [status, setStatus] = useState<MachineStatus>(machine?.status || "active");
  const [notes, setNotes] = useState(machine?.notes || "");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) return setError("Machine name is required.");

    setSaving(true);
    setError(null);

    const payload = {
      clinicId,
      name: name.trim(),
      sessionType,
      status,
      ...(serialNumber.trim() ? { serialNumber: serialNumber.trim() } : {}),
      ...(purchaseDate ? { purchaseDate } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    try {
      if (isEditing && machine) {
        await updateDoc(doc(db, "machines", machine.id), payload);
        onSaved({ ...machine, ...payload });
      } else {
        const createPayload = { ...payload, createdAt: Date.now() };
        const docRef = await addDoc(collection(db, "machines"), createPayload);
        onSaved({ id: docRef.id, ...createPayload });
      }
    } catch (err) {
      console.error("Failed to save machine:", err);
      setError("Couldn't save this machine. Please try again.");
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!machine) return;
    if (!confirm("Remove this machine from the registry?")) return;

    setDeleting(true);
    try {
      await deleteDoc(doc(db, "machines", machine.id));
      onDeleted?.(machine.id);
    } catch (err) {
      console.error("Failed to delete machine:", err);
      setError("Couldn't remove this machine. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-card">
        <h2 className="font-display text-lg font-medium text-brown-900">
          {isEditing ? "Edit Machine" : "Add Machine"}
        </h2>
        <div className="mb-5 mt-1 h-[2px] w-8 bg-gold-500" />

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">Machine Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q-Switch Nd:YAG #1"
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">Machine Type</label>
              <select
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value as SessionType)}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              >
                {(Object.keys(SESSION_TYPE_CONFIG) as SessionType[]).map((type) => (
                  <option key={type} value={type}>
                    {SESSION_TYPE_CONFIG[type].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MachineStatus)}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">
                Serial Number
              </label>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>
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
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">
              Notes <span className="text-brown-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Maintenance history, calibration dates, etc."
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          <div>
            {isEditing && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-sm font-medium text-red-700 hover:underline disabled:opacity-60"
              >
                {deleting ? "Removing…" : "Remove"}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-brown-600 hover:bg-beige-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
