"use client";

import Link from "next/link";
import { Calendar as CalendarIcon, CalendarCheck, ChevronRight, Receipt as ReceiptIcon, Stethoscope } from "lucide-react";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import { formatTime12h } from "@/lib/calendar";
import { STATUS_STYLES, STATUS_LABELS } from "@/components/appointments/statusStyles";
import EmptyState from "@/components/ui/EmptyState";
import type { Appointment } from "@/types";

/** Dashboard-only status colors — "booked" gets the new rust accent here
 * instead of Schedule's gold, everything else keeps the shared semantic
 * colors from statusStyles.ts (completed/cancelled/no-show mean the same
 * thing everywhere). Scoped to this component so Schedule's own calendar
 * views are untouched. */
const DASHBOARD_STATUS_STYLE = {
  ...STATUS_STYLES,
  booked: { bg: "bg-rust-100", text: "text-rust-700", dot: "bg-rust-600" },
};

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
      <div className="rounded-[18px] border border-beige-300 bg-surface shadow-soft">
        <div className="flex items-center gap-2 border-b border-beige-300 p-6">
          <CalendarIcon className="h-5 w-5 text-brown-400" />
          <h2 className="text-xl font-extrabold text-brown-900">Schedule</h2>
        </div>
        <div className="p-2">
          <EmptyState
            compact
            icon={CalendarCheck}
            title="No appointments booked for today."
            action={{ label: "Go to Schedule", href: "/dashboard/appointments" }}
          />
        </div>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-[18px] border border-beige-300 bg-surface shadow-soft">
      <div className="flex items-center justify-between border-b border-beige-300 p-6">
        <h2 className="flex items-center gap-2 text-xl font-extrabold text-brown-900">
          <CalendarIcon className="h-5 w-5 text-brown-400" />
          Schedule
        </h2>
      </div>

      <div className="divide-y divide-beige-300/60">
        {appointments.map((appt, i) => {
          const cfg = SESSION_TYPE_CONFIG[appt.sessionType];
          const statusStyle = DASHBOARD_STATUS_STYLE[appt.status];
          const linkedVisitId = visitIdByAppointmentId[appt.id];
          const hasReceipt = !!receiptedAppointmentIds[appt.id];
          // Online bookings from the public form arrive with no patientId —
          // there's no patient record to link to or log a visit against yet
          // (see components/appointments/UnlinkedBookingPanel.tsx for where
          // that gets resolved), so route these to Schedule instead of a
          // broken /dashboard/patients/ URL, and hide the actions that need
          // a real patientId.
          const isLinked = !!appt.patientId;
          const isDone = appt.status === "completed";
          const logVisitHref = `/dashboard/patients/${appt.patientId}?logVisit=1&sessionType=${encodeURIComponent(appt.sessionType)}&appointmentId=${appt.id}`;
          const generateReceiptHref = `/dashboard/packages?tab=receipts&newReceiptForPatient=${appt.patientId}&visitId=${linkedVisitId}`;

          const rowHref = isLinked ? `/dashboard/patients/${appt.patientId}` : "/dashboard/appointments";

          return (
            <div
              key={appt.id}
              style={{ animationDelay: `${i * 30}ms` }}
              className="animate-fade-up group relative flex flex-col gap-3 p-5 transition-colors hover:bg-beige-100/50 sm:flex-row sm:items-center sm:gap-6"
            >
              <div className="w-20 flex-shrink-0 sm:w-24">
                <span
                  className={`text-base font-bold sm:text-lg ${
                    isDone ? "text-brown-400 line-through decoration-brown-400/40" : "text-brown-900"
                  }`}
                >
                  {formatTime12h(appt.time)}
                </span>
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  {/* The stretched-link trick: this Link's ::after covers
                      the whole row (via the parent's `relative`), making
                      the entire row clickable/hoverable, while the action
                      pills below stay separate <a> tags instead of being
                      nested inside this one — invalid HTML that used to
                      cause a hydration mismatch here. */}
                  <p
                    className={`flex items-center gap-1 truncate text-base font-bold transition-colors group-hover:text-rust-600 sm:text-lg ${
                      isDone ? "text-brown-400" : "text-brown-900"
                    }`}
                  >
                    <Link href={rowHref} className="truncate after:absolute after:inset-0">
                      {appt.patientName}
                    </Link>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-sm font-medium text-brown-400">
                    {cfg && (
                      <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${cfg.badgeClassName}`}>
                        {cfg.badgeText}
                      </span>
                    )}
                    <span className="truncate">{cfg?.label ?? appt.sessionType}</span>
                    {!isLinked && (
                      <span className="flex-shrink-0 rounded-full bg-beige-200 px-2 py-0.5 text-[10px] font-medium text-brown-600">
                        Unlinked
                      </span>
                    )}
                  </p>
                </div>

                <div className="relative z-10 flex flex-shrink-0 items-center gap-2 sm:justify-end">
                  {isLinked && appt.status === "booked" && !linkedVisitId && (
                    <Link
                      href={logVisitHref}
                      className="flex items-center gap-1 rounded-full border border-rust-600 px-2.5 py-1 text-[11px] font-medium text-rust-700 transition-colors hover:bg-rust-100"
                    >
                      <Stethoscope size={12} /> Log Visit
                    </Link>
                  )}
                  {isLinked && appt.status === "booked" && linkedVisitId && !hasReceipt && (
                    <Link
                      href={generateReceiptHref}
                      className="flex items-center gap-1 rounded-full border border-rust-600 bg-rust-100 px-2.5 py-1 text-[11px] font-medium text-rust-700 transition-colors hover:bg-rust-100/70"
                    >
                      <ReceiptIcon size={12} /> Generate Receipt
                    </Link>
                  )}
                  <span
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusStyle.bg} ${statusStyle.text}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                    {STATUS_LABELS[appt.status]}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
