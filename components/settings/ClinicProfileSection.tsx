"use client";

import { useState } from "react";
import { updateClinicName, updateClinicAddress } from "@/app/dashboard/settings/actions";

export default function ClinicProfileSection({
  initialName,
  initialAddress,
  isOwner,
}: {
  initialName: string;
  initialAddress: string;
  isOwner: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [address, setAddress] = useState(initialAddress);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = name !== initialName || address !== initialAddress;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    if (name !== initialName) {
      const res = await updateClinicName(name);
      if (res.error) {
        setSaving(false);
        setError(res.error);
        return;
      }
    }
    if (address !== initialAddress) {
      const res = await updateClinicAddress(address);
      if (res.error) {
        setSaving(false);
        setError(res.error);
        return;
      }
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <h2 className="font-display text-lg font-medium text-brown-900">Clinic Profile</h2>
      <div className="mt-4 max-w-sm space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-brown-700">Clinic Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isOwner}
            className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500 disabled:text-brown-400"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-brown-700">
            Clinic Address <span className="text-brown-400">(optional)</span>
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={!isOwner}
            placeholder="e.g. 209 City Plaza, Opposite Heera Panna Complex, Yagnik Road, Rajkot"
            className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500 disabled:text-brown-400"
          />
          <p className="mt-1 text-xs text-brown-400">Printed under the clinic name on receipts.</p>
        </div>

        {isOwner && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {saved && <span className="text-sm text-green-700">Saved</span>}
            {error && <span className="text-sm text-red-700">{error}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
