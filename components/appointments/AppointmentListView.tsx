"use client";

import Link from "next/link";
import { Receipt as ReceiptIcon, Stethoscope } from "lucide-react";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import { formatTime12h, parseDateStr, timeToMinutes } from "@/lib/calendar";
import { STATUS_STYLES, STATUS_LABELS } from "./statusStyles";
import type { Appointment } from "@/types";

export default function AppointmentListView({
  appointments,
  onEdit,
  visitIdByAppointmentId,
  receiptedAppointmentIds,
}: {
  appointments: Appointment[];
  onEdit: (appt: Appointment) => void;
  visitIdByAppointmentId: Record<string, string>;
  receiptedAppointmentIds: Record<string, true>;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const grouped = new Map<string, Appointment[]>();
  for (const appt of appointments) {
    if (!grouped.has(appt.date)) grouped.set(appt.date, []);
    grouped.get(appt.date)!.push(appt);
  }

  const sortedDates = [...grouped.keys()].sort();

  for (const date of sortedDates) {
    grouped.get(date)!.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  }

  if (sortedDates.length === 0) {
    return (
      <div className="rounded-xl bg-surface p-10 text-center shadow-soft ring-1 ring-beige-300">
        <p className="text-sm text-brown-600">No appointments found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((date) => (
        <div key={date}>
          <h3 className="mb-2 font-display text-base font-medium text-brown-900">
            {parseDateStr(date).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h3>
          <div className="overflow-hidden rounded-xl bg-surface shadow-soft ring-1 ring-beige-300">
            {grouped.get(date)!.map((appt, i, arr) => {
              const cfg = SESSION_TYPE_CONFIG[appt.sessionType];
              const statusStyle = STATUS_STYLES[appt.status];
              const linkedVisitId = visitIdByAppointmentId[appt.id];
              const hasReceipt = !!receiptedAppointmentIds[appt.id];
              const logVisitHref = `/dashboard/patients/${appt.patientId}?logVisit=1&sessionType=${encodeURIComponent(appt.sessionType)}&appointmentId=${appt.id}`;
              const generateReceiptHref = `/dashboard/documents?tab=receipts&newReceiptForPatient=${appt.patientId}&visitId=${linkedVisitId}`;
              return (
                <div
                  key={appt.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onEdit(appt)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onEdit(appt)}
                  className={[
                    "flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 px-5 py-3 text-left text-sm transition-colors hover:bg-gold-100/40",
                    i !== arr.length - 1 ? "border-b border-beige-300" : "",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-3">
                    <span className="w-20 flex-shrink-0 font-medium text-brown-900">
                      {formatTime12h(appt.time)}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${cfg.badgeClassName}`}
                    >
                      {cfg.badgeText}
                    </span>
                    <span className="font-medium text-brown-900">{appt.patientName}</span>
                    <span className="text-brown-400">{appt.patientPhone}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {appt.status === "booked" && !linkedVisitId && (
                      <Link
                        href={logVisitHref}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 rounded-full border border-gold-500 px-2.5 py-1 text-[11px] font-medium text-gold-600 transition-colors hover:bg-gold-100"
                      >
                        <Stethoscope size={12} /> Log Visit
                      </Link>
                    )}
                    {appt.status === "booked" && linkedVisitId && !hasReceipt && (
                      <Link
                        href={generateReceiptHref}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 rounded-full border border-gold-500 bg-gold-100 px-2.5 py-1 text-[11px] font-medium text-gold-600 transition-colors hover:bg-gold-100/70"
                      >
                        <ReceiptIcon size={12} /> Generate Receipt
                      </Link>
                    )}
                    <span
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusStyle.bg} ${statusStyle.text}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                      {STATUS_LABELS[appt.status]}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
