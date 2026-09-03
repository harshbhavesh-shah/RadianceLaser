"use client";

import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import { formatTime12h, timeToMinutes } from "@/lib/calendar";
import { STATUS_STYLES, STATUS_LABELS } from "@/components/appointments/statusStyles";
import EmptyState from "@/components/ui/EmptyState";
import type { Appointment } from "@/types";

/** This week's appointments, grouped under each day of the week — a plain
 * read-only look at the week's shape (light days, heavy days), not another
 * place to work a booking forward. That stays Today's Appointments' job. */
export default function WeekAgenda({
  weekDays,
  appointments,
  todayStr,
}: {
  weekDays: Date[];
  appointments: Appointment[];
  todayStr: string;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();

  if (appointments.length === 0) {
    return (
      <EmptyState
        compact
        icon={CalendarRange}
        title="No appointments booked this week."
        action={{ label: "Go to Schedule", href: "/dashboard/appointments" }}
      />
    );
  }

  const byDate = new Map<string, Appointment[]>();
  for (const appt of appointments) {
    const list = byDate.get(appt.date) ?? [];
    list.push(appt);
    byDate.set(appt.date, list);
  }
  for (const list of byDate.values()) {
    list.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  }

  return (
    <div className="overflow-hidden rounded-xl bg-surface shadow-soft ring-1 ring-beige-300">
      {weekDays.map((day, dayIndex) => {
        const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
        const dayAppointments = byDate.get(dateStr) ?? [];
        const isToday = dateStr === todayStr;

        return (
          <div
            key={dateStr}
            className={dayIndex !== weekDays.length - 1 ? "border-b border-beige-300" : ""}
          >
            <div className="flex items-center gap-2 bg-beige-100/60 px-5 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-brown-600">
                {day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
              {isToday && (
                <span className="rounded-full bg-gold-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Today
                </span>
              )}
              <span className="ml-auto text-xs text-brown-400">
                {dayAppointments.length === 0 ? "—" : `${dayAppointments.length} appointment${dayAppointments.length === 1 ? "" : "s"}`}
              </span>
            </div>

            {dayAppointments.map((appt) => {
              const cfg = SESSION_TYPE_CONFIG[appt.sessionType];
              const statusStyle = STATUS_STYLES[appt.status];
              return (
                <Link
                  key={appt.id}
                  href={appt.patientId ? `/dashboard/patients/${appt.patientId}` : "/dashboard/appointments"}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm transition-colors hover:bg-beige-100/40"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="w-20 flex-shrink-0 text-brown-500">{formatTime12h(appt.time)}</span>
                    {cfg && (
                      <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${cfg.badgeClassName}`}>
                        {cfg.badgeText}
                      </span>
                    )}
                    <span className="truncate font-medium text-brown-900">{appt.patientName}</span>
                  </span>
                  <span
                    className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusStyle.bg} ${statusStyle.text}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                    {STATUS_LABELS[appt.status]}
                  </span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
