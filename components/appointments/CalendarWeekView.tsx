"use client";

import {
  CALENDAR_START_HOUR,
  CALENDAR_END_HOUR,
  PIXELS_PER_HOUR,
  minutesToTop,
  timeToMinutes,
  formatTime12h,
  layoutOverlappingEvents,
  toDateStr,
  todayLocalStr,
} from "@/lib/calendar";
import { SESSION_TYPE_CONFIG } from "@/lib/sessionTypes";
import { STATUS_STYLES } from "./statusStyles";
import type { Appointment } from "@/types";

const HOURS = Array.from(
  { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR },
  (_, i) => CALENDAR_START_HOUR + i
);
const GRID_HEIGHT = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * PIXELS_PER_HOUR;

export default function CalendarWeekView({
  days,
  appointments,
  onEdit,
  onCreateAt,
}: {
  days: Date[];
  appointments: Appointment[];
  onEdit: (appt: Appointment) => void;
  onCreateAt: (date: string, time: string) => void;
}) {
  const today = todayLocalStr();

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>, dateStr: string) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutesFromStart = (y / PIXELS_PER_HOUR) * 60;
    const totalMinutes = CALENDAR_START_HOUR * 60 + Math.round(minutesFromStart / 15) * 15;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    onCreateAt(dateStr, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }

  return (
    <div className="overflow-x-auto rounded-xl bg-surface shadow-soft ring-1 ring-beige-300">
      <div className="flex min-w-[720px]">
        <div className="w-16 flex-shrink-0 border-r border-beige-300" />
        {days.map((d) => {
          const dateStr = toDateStr(d);
          const isToday = dateStr === today;
          return (
            <div
              key={dateStr}
              className={`flex-1 border-r border-beige-300 py-3 text-center last:border-r-0 ${isToday ? "bg-gold-100/40" : ""}`}
            >
              <div className="text-xs uppercase tracking-wide text-brown-400">
                {d.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div
                className={`mt-0.5 font-display text-base font-medium ${isToday ? "text-gold-600" : "text-brown-900"}`}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex min-w-[720px]">
        <div className="w-16 flex-shrink-0">
          {HOURS.map((h) => (
            <div key={h} style={{ height: PIXELS_PER_HOUR }} className="relative">
              <span className="absolute -top-2 right-2 text-xs text-brown-400">
                {formatTime12h(`${String(h).padStart(2, "0")}:00`)}
              </span>
            </div>
          ))}
        </div>

        {days.map((d) => {
          const dateStr = toDateStr(d);
          const dayAppointments = appointments.filter((a) => a.date === dateStr);
          const laidOut = layoutOverlappingEvents(dayAppointments);
          const isToday = dateStr === today;

          return (
            <div
              key={dateStr}
              className={`relative flex-1 cursor-pointer border-l border-beige-300 ${isToday ? "bg-gold-100/10" : ""}`}
              style={{ height: GRID_HEIGHT }}
              onClick={(e) => handleGridClick(e, dateStr)}
            >
              {HOURS.map((h, i) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-beige-200"
                  style={{ top: i * PIXELS_PER_HOUR }}
                />
              ))}

              {laidOut.map(({ appointment, column, totalColumns }) => {
                const top = minutesToTop(timeToMinutes(appointment.time));
                const height = Math.max((appointment.durationMinutes / 60) * PIXELS_PER_HOUR, 20);
                const widthPct = 100 / totalColumns;
                const cfg = SESSION_TYPE_CONFIG[appointment.sessionType];
                const statusStyle = STATUS_STYLES[appointment.status];

                return (
                  <button
                    key={appointment.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(appointment);
                    }}
                    className={`absolute overflow-hidden rounded border-l-2 px-1.5 py-0.5 text-left text-[10px] shadow-sm outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-gold-500 ${statusStyle.bg}`}
                    style={{
                      top,
                      height,
                      left: `${column * widthPct}%`,
                      width: `calc(${widthPct}% - 2px)`,
                      borderLeftColor: appointment.status === "cancelled" ? "#9C8672" : "#A9812F",
                    }}
                  >
                    <div className="truncate font-medium text-brown-900">
                      {appointment.patientName}
                    </div>
                    <div className="truncate text-brown-600">
                      {cfg.badgeText} · {formatTime12h(appointment.time)}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
