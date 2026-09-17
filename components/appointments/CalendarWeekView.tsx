"use client";

import { useState } from "react";
import { Users } from "lucide-react";
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
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import { SCHEDULE_STATUS_STYLE } from "./scheduleStatusStyles";
import OverlapPopover from "./OverlapPopover";
import type { Appointment } from "@/types";

const HOURS = Array.from(
  { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR },
  (_, i) => CALENDAR_START_HOUR + i
);
const GRID_HEIGHT = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * PIXELS_PER_HOUR;

// Above this many side-by-side columns, each appointment's slice of the
// day column gets too narrow to show more than a letter or two of the
// patient name — past that point, the whole overlapping cluster collapses
// into one "N appointments" indicator instead (see OverlapPopover).
const OVERLAP_COLLAPSE_THRESHOLD = 3;

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
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const today = todayLocalStr();
  const [openCluster, setOpenCluster] = useState<string | null>(null);

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
    <div className="overflow-x-auto rounded-[18px] border border-beige-300 bg-surface shadow-soft">
      <div className="flex min-w-[720px] border-b border-beige-300 bg-beige-100/40">
        <div className="w-16 flex-shrink-0 border-r border-beige-300" />
        {days.map((d) => {
          const dateStr = toDateStr(d);
          const isToday = dateStr === today;
          return (
            <div
              key={dateStr}
              className={`flex-1 border-r border-beige-300/50 py-4 text-center last:border-r-0 ${isToday ? "bg-rust-600/5" : ""}`}
            >
              <div className={`text-[11px] font-bold uppercase tracking-wider ${isToday ? "text-rust-600" : "text-brown-400"}`}>
                {d.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div
                className={`mt-1 text-xl font-extrabold ${isToday ? "text-rust-600" : "text-brown-900"}`}
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
              <span className="absolute -top-2 right-3 bg-surface px-1 text-[11px] font-extrabold text-brown-400">
                {formatTime12h(`${String(h).padStart(2, "0")}:00`)}
              </span>
            </div>
          ))}
        </div>

        {days.map((d, dayIndex) => {
          const dateStr = toDateStr(d);
          const dayAppointments = appointments.filter((a) => a.date === dateStr);
          const laidOut = layoutOverlappingEvents(dayAppointments);
          const isToday = dateStr === today;
          // The last couple of day columns are close enough to the grid's
          // right edge that a rightward-opening popover would run off
          // screen — open those leftward instead.
          const popoverAlign = dayIndex >= days.length - 2 ? "right" : "left";

          return (
            <div
              key={dateStr}
              className={`relative flex-1 cursor-pointer border-l border-beige-300 ${isToday ? "bg-rust-600/[0.03]" : ""}`}
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

              {(() => {
                const renderedClusters = new Set<string>();
                return laidOut.map(
                  ({ appointment, column, totalColumns, clusterAppointments, clusterStart, clusterEnd }) => {
                    if (totalColumns > OVERLAP_COLLAPSE_THRESHOLD) {
                      const clusterKey = `${dateStr}-${clusterStart}`;
                      if (renderedClusters.has(clusterKey)) return null;
                      renderedClusters.add(clusterKey);

                      const top = minutesToTop(clusterStart);
                      const height = Math.max(((clusterEnd - clusterStart) / 60) * PIXELS_PER_HOUR, 20);
                      const isOpen = openCluster === clusterKey;

                      return (
                        <div key={clusterKey} className="absolute" style={{ top, height, left: 0, right: 2 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenCluster(isOpen ? null : clusterKey);
                            }}
                            className="flex h-full w-full items-center justify-center gap-1 rounded-lg border border-beige-300 bg-beige-100 text-brown-700 shadow-sm transition-colors hover:bg-beige-200"
                          >
                            <Users size={13} />
                            <span className="text-xs font-extrabold">{clusterAppointments.length}</span>
                          </button>
                          {isOpen && (
                            <OverlapPopover
                              appointments={clusterAppointments}
                              align={popoverAlign}
                              onSelect={(a) => {
                                setOpenCluster(null);
                                onEdit(a);
                              }}
                              onClose={() => setOpenCluster(null)}
                            />
                          )}
                        </div>
                      );
                    }

                    const top = minutesToTop(timeToMinutes(appointment.time));
                    const height = Math.max((appointment.durationMinutes / 60) * PIXELS_PER_HOUR, 20);
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
                        className={`absolute overflow-hidden rounded-lg border border-beige-300 px-2 py-1 text-left shadow-sm outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-rust-600 ${statusStyle.bg}`}
                        style={{
                          top,
                          height,
                          left: `${column * widthPct}%`,
                          width: `calc(${widthPct}% - 2px)`,
                          borderLeftWidth: 3,
                          borderLeftColor: appointment.status === "cancelled" ? "#9C8672" : "#C1694F",
                        }}
                      >
                        <div className="truncate text-xs font-extrabold text-brown-900">
                          {appointment.patientName}
                        </div>
                        <div className="truncate text-[11px] font-semibold text-brown-600">
                          {cfg.badgeText} · {formatTime12h(appointment.time)}
                        </div>
                      </button>
                    );
                  }
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
