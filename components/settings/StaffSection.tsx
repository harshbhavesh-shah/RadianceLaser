"use client";

import { useState } from "react";
import { updateStaffRole, removeStaffMember } from "@/app/dashboard/settings/actions";
import AddStaffModal from "./AddStaffModal";
import type { StaffMember, UserRole } from "@/types";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "reception", label: "Reception" },
  { value: "doctor", label: "Doctor" },
  { value: "owner", label: "Owner" },
];

export default function StaffSection({
  initialStaff,
  currentUid,
  isOwner,
}: {
  initialStaff: StaffMember[];
  currentUid: string;
  isOwner: boolean;
}) {
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [modalOpen, setModalOpen] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRoleChange(uid: string, newRole: UserRole) {
    setBusyUid(uid);
    setError(null);
    const res = await updateStaffRole(uid, newRole);
    setBusyUid(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setStaff((prev) => prev.map((s) => (s.uid === uid ? { ...s, role: newRole } : s)));
  }

  async function handleRemove(uid: string, name: string) {
    if (!confirm(`Remove ${name} from this clinic? They'll immediately lose access.`)) return;
    setBusyUid(uid);
    setError(null);
    const res = await removeStaffMember(uid);
    setBusyUid(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setStaff((prev) => prev.filter((s) => s.uid !== uid));
  }

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-medium text-brown-900">Staff</h2>
        {isOwner && (
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
          >
            + Add Staff
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

      <div className="space-y-2">
        {staff.map((member) => {
          const isSelf = member.uid === currentUid;
          const isBusy = busyUid === member.uid;
          return (
            <div
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-beige-300 px-4 py-3"
            >
              <div>
                <div className="text-sm font-medium text-brown-900">
                  {member.name}
                  {isSelf && <span className="ml-2 text-xs text-brown-400">(you)</span>}
                </div>
                <div className="text-xs text-brown-400">{member.email}</div>
              </div>

              <div className="flex items-center gap-3">
                {isOwner && !isSelf ? (
                  <select
                    value={member.role}
                    disabled={isBusy}
                    onChange={(e) => handleRoleChange(member.uid, e.target.value as UserRole)}
                    className="rounded-md border border-beige-300 bg-canvas px-2 py-1 text-xs text-brown-900 outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="rounded-full bg-beige-200 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brown-600">
                    {member.role}
                  </span>
                )}

                {isOwner && !isSelf && (
                  <button
                    onClick={() => handleRemove(member.uid, member.name)}
                    disabled={isBusy}
                    className="text-xs font-medium text-red-700 hover:underline disabled:opacity-60"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <AddStaffModal
          onClose={() => setModalOpen(false)}
          onAdded={(newStaff) => setStaff((prev) => [...prev, newStaff])}
        />
      )}
    </div>
  );
}
