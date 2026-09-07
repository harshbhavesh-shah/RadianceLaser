"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { activateAccountAction, deleteClinicAction, extendAccessAction, terminateAccessAction } from "@/app/admin/actions";
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

function deadlineLabel(clinic: Clinic): string {
  if (clinic.subscriptionStatus === "trialing") return `Trial ends ${formatDate(clinic.trialEndsAt)}`;
  if (clinic.subscriptionRenewsAt !== undefined) return `Renews ${formatDate(clinic.subscriptionRenewsAt)}`;
  return "—";
}

/** The extend/terminate/delete controls — identical behavior whether
 * rendered in the desktop table's last cell or the mobile card's footer
 * (see ClinicsTable below). Each render gets its own independent state,
 * which is harmless since only one layout is ever visible at a time. */
function ClinicActions({ clinic, annualPriceInr }: { clinic: Clinic; annualPriceInr: number }) {
  const router = useRouter();
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

  // "Active" (not just "trial extended") — for a clinic that actually paid
  // outside the app (bank transfer, cash, etc.). Also logs the sale on the
  // Ledger at the current price, so it shows up there without your having
  // to remember to add it separately — see activateAccountAction.
  async function handleActivate() {
    if (
      !confirm(
        `Activate "${clinic.name}" for 1 year, as if they just paid ₹${annualPriceInr.toLocaleString("en-IN")}?\n\n` +
          `This also logs ₹${annualPriceInr.toLocaleString("en-IN")} as profit in the Ledger.`
      )
    ) {
      return;
    }
    setIsPending(true);
    setError(null);
    const result = await activateAccountAction(clinic.id);
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

  // Typing the exact clinic name is a stronger safeguard than a plain
  // confirm() dialog for something this irreversible — a stray click on
  // "OK" is easy, retyping a specific name isn't.
  async function handleDelete() {
    const typed = prompt(
      `This permanently deletes "${clinic.name}" — every patient, visit, package, appointment, receipt, ` +
        `staff login, and document. There is no undo.\n\nType the clinic's exact name to confirm:`
    );
    if (typed !== clinic.name) {
      if (typed !== null) alert("Name didn't match — nothing was deleted.");
      return;
    }
    setIsPending(true);
    setError(null);
    const result = await deleteClinicAction(clinic.id);
    setIsPending(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div>
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
          onClick={handleActivate}
          disabled={isPending}
          className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-800 disabled:opacity-50"
        >
          Activate (1yr)
        </button>
        <button
          onClick={handleTerminate}
          disabled={isPending}
          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
        >
          Terminate
        </button>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-800 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
      {error && <div className="mt-1 text-xs text-red-700">{error}</div>}
    </div>
  );
}

function ClinicRow({ clinic, annualPriceInr }: { clinic: Clinic; annualPriceInr: number }) {
  const access = getClinicAccess(clinic);
  return (
    <tr className="border-b border-beige-300 last:border-0">
      <td className="px-4 py-3">
        <div className="font-medium text-brown-900">{clinic.name}</div>
        <div className="text-xs text-brown-400">{clinic.id}</div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge access={access} />
      </td>
      <td className="px-4 py-3 text-sm text-brown-600">{deadlineLabel(clinic)}</td>
      <td className="px-4 py-3">
        <ClinicActions clinic={clinic} annualPriceInr={annualPriceInr} />
      </td>
    </tr>
  );
}

/** Same information as ClinicRow, restacked into a card — a 4-column table
 * has no room to breathe below md, where the viewport itself is often
 * narrower than the Status/Deadline/Actions columns need. */
function ClinicCard({ clinic, annualPriceInr }: { clinic: Clinic; annualPriceInr: number }) {
  const access = getClinicAccess(clinic);
  return (
    <div className="rounded-xl bg-surface p-4 shadow-soft ring-1 ring-beige-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium text-brown-900">{clinic.name}</div>
          <div className="truncate text-xs text-brown-400">{clinic.id}</div>
        </div>
        <StatusBadge access={access} />
      </div>
      <div className="mt-2 text-sm text-brown-600">{deadlineLabel(clinic)}</div>
      <div className="mt-3 border-t border-beige-300 pt-3">
        <ClinicActions clinic={clinic} annualPriceInr={annualPriceInr} />
      </div>
    </div>
  );
}

export default function ClinicsTable({ clinics, annualPriceInr }: { clinics: Clinic[]; annualPriceInr: number }) {
  if (clinics.length === 0) {
    return <p className="text-sm text-brown-400">No clinics yet.</p>;
  }

  return (
    <>
      {/* Mobile: stacked cards — a table this dense has nowhere to put a
          Status badge, a Deadline string, and three action buttons at
          phone widths. */}
      <div className="space-y-3 md:hidden">
        {clinics.map((clinic) => (
          <ClinicCard key={clinic.id} clinic={clinic} annualPriceInr={annualPriceInr} />
        ))}
      </div>

      {/* md+: the original table. */}
      <div className="hidden overflow-x-auto rounded-xl bg-surface shadow-soft ring-1 ring-beige-300 md:block">
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
              <ClinicRow key={clinic.id} clinic={clinic} annualPriceInr={annualPriceInr} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
