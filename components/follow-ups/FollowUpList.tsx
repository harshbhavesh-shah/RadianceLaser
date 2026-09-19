"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { sendVisitFollowUpNowAction, clearVisitFollowUpAction } from "@/app/dashboard/no-shows/actions";
import type { SessionTypeConfig } from "@/lib/sessionTypes";
import type { Visit } from "@/types";

export interface FollowUpRow {
  visit: Visit;
  patientName: string;
  patientPhone: string;
}

function formatVisitDate(dateStr: string): string {
  if (!dateStr) return "an earlier visit";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** One day's worth of follow-ups — each card can send the visit's
 * follow-up note to the patient over WhatsApp right now, or be dismissed
 * (done or skipped) once it no longer needs to show up here. */
export default function FollowUpList({
  title,
  dateLabel,
  rows: initialRows,
  sessionTypeConfig,
  highlight = false,
}: {
  title: string;
  dateLabel: string;
  rows: FollowUpRow[];
  sessionTypeConfig: Record<string, SessionTypeConfig>;
  highlight?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<{ id: string; message: string } | null>(null);

  function removeRow(visitId: string) {
    setRows((prev) => prev.filter((r) => r.visit.id !== visitId));
    router.refresh();
  }

  async function handleSendNow(row: FollowUpRow) {
    setBusyId(row.visit.id);
    setErrorId(null);
    const result = await sendVisitFollowUpNowAction(
      row.visit.id,
      row.patientName,
      row.patientPhone,
      row.visit.followUpNote || ""
    );
    setBusyId(null);
    if (result.error) {
      setErrorId({ id: row.visit.id, message: result.error });
      return;
    }
    removeRow(row.visit.id);
  }

  async function handleClear(visitId: string) {
    setBusyId(visitId);
    setErrorId(null);
    const result = await clearVisitFollowUpAction(visitId);
    setBusyId(null);
    if (result.error) {
      setErrorId({ id: visitId, message: result.error });
      return;
    }
    removeRow(visitId);
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-xl font-extrabold text-brown-900">{title}</h2>
        <span className="text-[13px] font-semibold text-brown-400">
          {dateLabel} &middot; {rows.length} patient{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState compact icon={CalendarClock} title="No follow-ups." />
      ) : (
        <div className="flex flex-col gap-3.5">
          {rows.map(({ visit, patientName, patientPhone }) => {
            const cfg = sessionTypeConfig[visit.sessionType];
            const busy = busyId === visit.id;
            const error = errorId?.id === visit.id ? errorId.message : null;
            return (
              <div
                key={visit.id}
                className={`flex flex-col gap-3.5 rounded-2xl bg-surface p-6 shadow-soft ${
                  highlight ? "border-t-[3px] border-rust-600" : "border-t-[3px] border-beige-300"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-beige-200 text-sm font-bold text-rust-700">
                      {initialsOf(patientName)}
                    </div>
                    <div className="flex flex-col">
                      <Link
                        href={`/dashboard/patients/${visit.patientId}`}
                        className="text-base font-bold text-brown-900 hover:text-rust-600"
                      >
                        {patientName}
                      </Link>
                      <span className="text-[13px] font-semibold text-brown-400">{patientPhone}</span>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    {cfg && (
                      <span className={`rounded-md px-1.5 py-[3px] text-[10px] font-extrabold tracking-wide ${cfg.badgeClassName}`}>
                        {cfg.badgeText}
                      </span>
                    )}
                    <span className="whitespace-nowrap text-xs font-semibold text-brown-400">
                      From the visit on {formatVisitDate(visit.date)}
                    </span>
                  </div>
                </div>

                {visit.followUpNote && <p className="text-sm font-medium text-brown-600">{visit.followUpNote}</p>}

                {error && <p className="text-xs font-semibold text-red-700">{error}</p>}

                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSendNow({ visit, patientName, patientPhone })}
                    disabled={busy}
                    className={`flex-1 rounded-[10px] py-2.5 text-[13px] font-bold transition-colors disabled:opacity-60 ${
                      highlight
                        ? "bg-rust-600 text-white hover:bg-rust-700"
                        : "border border-beige-300 bg-surface text-brown-900 hover:bg-beige-100/60"
                    }`}
                  >
                    {busy ? "Sending…" : "Send Follow-up Now"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClear(visit.id)}
                    disabled={busy}
                    className="rounded-[10px] border border-beige-300 bg-surface px-4 py-2.5 text-[13px] font-bold text-brown-900 transition-colors hover:bg-beige-100/60 disabled:opacity-60"
                  >
                    Mark Done
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClear(visit.id)}
                    disabled={busy}
                    className="rounded-[10px] border border-beige-300 bg-surface px-4 py-2.5 text-[13px] font-bold text-brown-400 transition-colors hover:bg-beige-100/60 disabled:opacity-60"
                  >
                    Skip
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
