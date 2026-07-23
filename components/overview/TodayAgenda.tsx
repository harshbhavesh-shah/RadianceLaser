"use client";

import Link from "next/link";
import { CalendarCheck, Receipt as ReceiptIcon, Stethoscope } from "lucide-react";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import { formatTime12h } from "@/lib/calendar";
import { STATUS_STYLES, STATUS_LABELS } from "@/components/appointments/statusStyles";
import type { Appointment } from "@/types";

/** The spine of the Overview page — today's appointments in order, one tap
 * away from the patient, with a pipeline action that carries a booked
 * appointment forward: "Log Visit" until a visit exists, then "Generate
 * Receipt" until a receipt does (see lib/pipeline.ts and lib/overview.ts —
 * the appointment auto-completes once both exist). Status changes
 * themselves still happen from the Schedule page's own modal, so this stays
 * a fast, glanceable morning briefing rather than another booking manager. */
export default function TodayAgenda({
  appointments,
  visitIdByAppointmentId,
  receiptedAppointmentIds,
}: {
  appointments: Appointment[];
  visitIdByAppointmentId: Record<string, string>;
  receiptedAppointmentIds: Record<string, true>;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();

  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-xl bg-surface p-8 text-center shadow-soft ring-1 ring-beige-300">
        <CalendarCheck className="text-brown-400" size={26} />
        <p className="mt-2 text-sm text-brown-400">No appointments booked for today.</p>
        <Link href="/dashboard/appointments" className="mt-2 text-sm font-medium text-gold-600 hover:underline">
          Go to Schedule
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-surface shadow-soft ring-1 ring-beige-300">
      {appointments.map((appt, i) => {
        const cfg = SESSION_TYPE_CONFIG[appt.sessionType];
        const statusStyle = STATUS_STYLES[appt.status];
        const linkedVisitId = visitIdByAppointmentId[appt.id];
        const hasReceipt = !!receiptedAppointmentIds[appt.id];
        const logVisitHref = `/dashboard/patients/${appt.patientId}?logVisit=1&sessionType=${encodeURIComponent(appt.sessionType)}&appointmentId=${appt.id}`;
        const generateReceiptHref = `/dashboard/documents?tab=receipts&newReceiptForPatient=${appt.patientId}&visitId=${linkedVisitId}`;

        return (
          <div
            key={appt.id}
            style={{ animationDelay: `${i * 30}ms` }}
            className={[
              "animate-fade-up flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 text-sm",
              i !== appointments.length - 1 ? "border-b border-beige-300" : "",
            ].join(" ")}
          >
            <Link
              href={`/dashboard/patients/${appt.patientId}`}
              className="flex min-w-0 flex-1 items-center gap-3 transition-colors hover:text-gold-600"
            >
              <span className="w-20 flex-shrink-0 font-medium text-brown-900">
                {formatTime12h(appt.time)}
              </span>
              {cfg && (
                <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${cfg.badgeClassName}`}>
                  {cfg.badgeText}
                </span>
              )}
              <span className="truncate font-medium text-brown-900">{appt.patientName}</span>
              <span className="hidden flex-shrink-0 text-brown-400 sm:inline">{appt.patientPhone}</span>
            </Link>

            <span className="flex flex-shrink-0 items-center gap-2">
              {appt.status === "booked" && !linkedVisitId && (
                <Link
                  href={logVisitHref}
                  className="flex items-center gap-1 rounded-full border border-gold-500 px-2.5 py-1 text-[11px] font-medium text-gold-600 transition-colors hover:bg-gold-100"
                >
                  <Stethoscope size={12} /> Log Visit
                </Link>
              )}
              {appt.status === "booked" && linkedVisitId && !hasReceipt && (
                <Link
                  href={generateReceiptHref}
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
  );
}
