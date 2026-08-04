"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { extendAccessAction, terminateAccessAction } from "@/app/admin/actions";
import { getClinicAccess, type ClinicAccess } from "@/lib/subscription";
import type { Clinic } from "@/types";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function StatusBadge({ access }: { access: ClinicAccess }) {
  if (access.status === "locked") {
    return (
      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">Locked</span>
    );
  }
  if (access.status === "trialing") {
    return (
      <span className="rounded-full bg-gold-100 px-2.5 py-1 text-xs font-medium text-brown-800">
        Trial · {access.daysRemaining}d left
      </span>
    );
  }
  return (
    <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
      Active{access.renewsInDays !== undefined ? ` · renews in ${access.renewsInDays}d` : ""}
    </span>
  );
}

function ClinicRow({ clinic }: { clinic: Clinic }) {
  const router = useRouter();
  const access = getClinicAccess(clinic);
  const [days, setDays] = useState(30);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExtend() {
    setIsPending(true);
    setError(null);
    const result = await extendAccessAction(clinic.id, days);
    setIsPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  async function handleTerminate() {
    if (!confirm(`Terminate access for "${clinic.name}"? This locks them out of writes immediately.`)) {
      return;
    }
    setIsPending(true);
    setError(null);
    const result = await terminateAccessAction(clinic.id);
    setIsPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <tr className="border-b border-beige-300 last:border-0">
      <td className="px-4 py-3">
        <div className="font-medium text-brown-900">{clinic.name}</div>
        <div className="text-xs text-brown-400">{clinic.id}</div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge access={access} />
      </td>
      <td className="px-4 py-3 text-sm text-brown-600">
        {clinic.subscriptionStatus === "trialing" && `Trial ends ${formatDate(clinic.trialEndsAt)}`}
        {clinic.subscriptionRenewsAt !== undefined &&
          clinic.subscriptionStatus !== "trialing" &&
          `Renews ${formatDate(clinic.subscriptionRenewsAt)}`}
        {clinic.subscriptionRenewsAt === undefined && clinic.subscriptionStatus !== "trialing" && "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-16 rounded-md border border-beige-300 bg-canvas px-2 py-1 text-sm text-brown-900 outline-none focus:border-gold-500"
          />
          <span className="text-xs text-brown-400">days</span>
          <button
            onClick={handleExtend}
            disabled={isPending}
            className="rounded-md bg-brown-900 px-3 py-1.5 text-xs font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-50"
          >
            Extend
          </button>
          <button
            onClick={handleTerminate}
            disabled={isPending}
            className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            Terminate
          </button>
        </div>
        {error && <div className="mt-1 text-xs text-red-700">{error}</div>}
      </td>
    </tr>
  );
}

export default function ClinicsTable({ clinics }: { clinics: Clinic[] }) {
  if (clinics.length === 0) {
    return <p className="text-sm text-brown-400">No clinics yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-surface shadow-soft ring-1 ring-beige-300">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-beige-300 bg-beige-200/50 text-xs uppercase tracking-wide text-brown-600">
            <th className="px-4 py-3 font-medium">Clinic</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Deadline</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {clinics.map((clinic) => (
            <ClinicRow key={clinic.id} clinic={clinic} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
