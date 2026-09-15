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
} from "@/lib/calendar";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import { SCHEDULE_STATUS_STYLE } from "./scheduleStatusStyles";
import type { Appointment } from "@/types";

const HOURS = Array.from(
  { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR },
  (_, i) => CALENDAR_START_HOUR + i
);
const GRID_HEIGHT = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * PIXELS_PER_HOUR;

export default function CalendarDayView({
  date,
  appointments,
  onEdit,
  onCreateAt,
}: {
  date: Date;
  appointments: Appointment[];
  onEdit: (appt: Appointment) => void;
  onCreateAt: (date: string, time: string) => void;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const dateStr = toDateStr(date);
  const dayAppointments = appointments.filter((a) => a.date === dateStr);
  const laidOut = layoutOverlappingEvents(dayAppointments);

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutesFromStart = (y / PIXELS_PER_HOUR) * 60;
    const totalMinutes = CALENDAR_START_HOUR * 60 + Math.round(minutesFromStart / 15) * 15;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    onCreateAt(dateStr, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-beige-300 bg-surface shadow-soft">
      <div className="flex">
        <div className="w-16 flex-shrink-0 border-r border-beige-300" />
        <div className="flex-1 px-4 py-3 text-center font-display text-base font-medium text-brown-900">
          {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      <div className="flex">
        <div className="w-16 flex-shrink-0">
          {HOURS.map((h) => (
            <div key={h} style={{ height: PIXELS_PER_HOUR }} className="relative">
              <span className="absolute -top-2 right-2 text-xs text-brown-400">
                {formatTime12h(`${String(h).padStart(2, "0")}:00`)}
              </span>
            </div>
          ))}
        </div>

        <div
          className="relative flex-1 cursor-pointer border-l border-beige-300"
          style={{ height: GRID_HEIGHT }}
          onClick={handleGridClick}
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
            const height = Math.max((appointment.durationMinutes / 60) * PIXELS_PER_HOUR, 22);
            const widthPct = 100 / totalColumns;
            const cfg = SESSION_TYPE_CONFIG[appointment.sessionType];
            const statusStyle = SCHEDULE_STATUS_STYLE[appointment.status];

            return (
              <button
                key={appointment.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(appointment);
                }}
                className={`absolute overflow-hidden rounded-md border-l-2 px-2 py-1 text-left text-xs shadow-sm outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-rust-600 ${statusStyle.bg}`}
                style={{
                  top,
                  height,
                  left: `${column * widthPct}%`,
                  width: `calc(${widthPct}% - 4px)`,
                  borderLeftColor:
                    appointment.status === "cancelled" ? "#9C8672" : "#C1442D",
                }}
              >
                <div className="flex items-center gap-1 font-medium text-brown-900">
                  <span
                    className={`flex-shrink-0 rounded px-1 text-[9px] font-bold ${cfg.badgeClassName}`}
                  >
                    {cfg.badgeText}
                  </span>
                  <span className="min-w-0 truncate">{appointment.patientName}</span>
                </div>
                <div className="truncate text-brown-600">{formatTime12h(appointment.time)}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
