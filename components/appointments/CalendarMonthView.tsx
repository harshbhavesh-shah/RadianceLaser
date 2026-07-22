"use client";

import { getMonthGridDays, toDateStr, todayLocalStr, formatTime12h } from "@/lib/calendar";
import { SESSION_TYPE_CONFIG } from "@/lib/sessionTypes";
import { STATUS_STYLES } from "./statusStyles";
import type { Appointment } from "@/types";

const MAX_VISIBLE_PER_DAY = 3;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarMonthView({
  anchor,
  appointments,
  onEdit,
  onCreateAt,
  onShowDay,
}: {
  anchor: Date;
  appointments: Appointment[];
  onEdit: (appt: Appointment) => void;
  onCreateAt: (date: string, time: string) => void;
  onShowDay: (date: Date) => void;
}) {
  const days = getMonthGridDays(anchor);
  const currentMonth = anchor.getMonth();
  const today = todayLocalStr();

  const byDate = new Map<string, Appointment[]>();
  for (const appt of appointments) {
    if (!byDate.has(appt.date)) byDate.set(appt.date, []);
    byDate.get(appt.date)!.push(appt);
  }
  for (const list of byDate.values()) {
    list.sort((a, b) => a.time.localeCompare(b.time));
  }

  return (
    <div className="overflow-hidden rounded-xl bg-surface shadow-soft ring-1 ring-beige-300">
      <div className="grid grid-cols-7 border-b border-beige-300 bg-beige-200/50">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-brown-600"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((d) => {
          const dateStr = toDateStr(d);
          const isCurrentMonth = d.getMonth() === currentMonth;
          const isToday = dateStr === today;
          const dayAppointments = byDate.get(dateStr) || [];
          const visible = dayAppointments.slice(0, MAX_VISIBLE_PER_DAY);
          const overflow = dayAppointments.length - visible.length;

          return (
            <div
              key={dateStr}
              className={`min-h-[110px] border-b border-r border-beige-300 p-1.5 [&:nth-child(7n)]:border-r-0 ${
                isCurrentMonth ? "" : "bg-beige-200/20"
              }`}
              onClick={() => onCreateAt(dateStr, "10:00")}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShowDay(d);
                }}
                className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors hover:bg-gold-100 ${
                  isToday
                    ? "bg-gold-500 text-white"
                    : isCurrentMonth
                      ? "text-brown-900"
                      : "text-brown-400"
                }`}
              >
                {d.getDate()}
              </button>

              <div className="space-y-1">
                {visible.map((appt) => {
                  const cfg = SESSION_TYPE_CONFIG[appt.sessionType];
                  const statusStyle = STATUS_STYLES[appt.status];
                  return (
                    <button
                      key={appt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(appt);
                      }}
                      className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] outline-none focus-visible:ring-2 focus-visible:ring-gold-500 ${statusStyle.bg} ${statusStyle.text}`}
                      title={`${formatTime12h(appt.time)} — ${appt.patientName}`}
                    >
                      <span className={`mr-1 rounded px-1 text-[8px] font-bold ${cfg.badgeClassName}`}>
                        {cfg.badgeText}
                      </span>
                      {appt.patientName}
                    </button>
                  );
                })}
                {overflow > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowDay(d);
                    }}
                    className="block w-full truncate px-1.5 text-left text-[10px] font-medium text-brown-400 hover:text-gold-600"
                  >
                    +{overflow} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
