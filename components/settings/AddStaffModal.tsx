"use client";

import { useState } from "react";
import { addStaffMember } from "@/app/dashboard/settings/actions";
import type { StaffMember, UserRole } from "@/types";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "reception", label: "Reception" },
  { value: "doctor", label: "Doctor" },
  { value: "owner", label: "Owner" },
];

export default function AddStaffModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (staff: StaffMember) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("reception");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ staff: StaffMember; tempPassword: string } | null>(null);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    const res = await addStaffMember(name, email, role);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.success) {
      setResult(res.success);
      onAdded(res.success.staff);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-card">
        {result ? (
          <>
            <h2 className="font-display text-lg font-medium text-brown-900">Staff Member Added</h2>
            <div className="mb-5 mt-1 h-[2px] w-8 bg-gold-500" />
            <p className="text-sm text-brown-600">
              Share these sign-in details with <strong>{result.staff.name}</strong> — this
              password is shown only once, so make sure to copy it now. They can change it after
              logging in.
            </p>
            <div className="mt-4 space-y-2 rounded-lg border border-beige-300 bg-canvas p-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-brown-400">Email</div>
                <div className="text-sm text-brown-900">{result.staff.email}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-brown-400">
                  Temporary Password
                </div>
                <div className="font-mono text-sm text-brown-900">{result.tempPassword}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="mt-6 w-full rounded-md bg-brown-900 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <h2 className="font-display text-lg font-medium text-brown-900">Add Staff Member</h2>
            <div className="mb-5 mt-1 h-[2px] w-8 bg-gold-500" />

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brown-700">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brown-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brown-700">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-brown-600 hover:bg-beige-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
              >
                {saving ? "Adding…" : "Add Staff Member"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
