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

// Day view has a full-width column to work with (vs Week's 1/7th), so it
// can comfortably fit one more side-by-side card before collapsing — see
// CalendarWeekView's own copy of this comment for why this exists at all.
const OVERLAP_COLLAPSE_THRESHOLD = 4;

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
  const [openCluster, setOpenCluster] = useState<number | null>(null);

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
    <div className="overflow-hidden rounded-[18px] border border-beige-300 bg-surface shadow-soft">
      <div className="flex border-b border-beige-300 bg-beige-100/40">
        <div className="w-16 flex-shrink-0 border-r border-beige-300" />
        <div className="flex-1 px-4 py-4 text-center text-xl font-extrabold text-brown-900">
          {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </div>
      </div>

      <div className="flex">
        <div className="w-16 flex-shrink-0">
          {HOURS.map((h) => (
            <div key={h} style={{ height: PIXELS_PER_HOUR }} className="relative">
              <span className="absolute -top-2 right-3 bg-surface px-1 text-[11px] font-extrabold text-brown-400">
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

          {(() => {
            const renderedClusters = new Set<number>();
            return laidOut.map(
              ({ appointment, column, totalColumns, clusterAppointments, clusterStart, clusterEnd }) => {
                if (totalColumns > OVERLAP_COLLAPSE_THRESHOLD) {
                  if (renderedClusters.has(clusterStart)) return null;
                  renderedClusters.add(clusterStart);

                  const top = minutesToTop(clusterStart);
                  const height = Math.max(((clusterEnd - clusterStart) / 60) * PIXELS_PER_HOUR, 22);
                  const isOpen = openCluster === clusterStart;

                  return (
                    <div key={clusterStart} className="absolute" style={{ top, height, left: 0, right: 4 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenCluster(isOpen ? null : clusterStart);
                        }}
                        className="flex h-full w-full items-center justify-center gap-1.5 rounded-lg border border-beige-300 bg-beige-100 text-brown-700 shadow-sm transition-colors hover:bg-beige-200"
                      >
                        <Users size={14} />
                        <span className="text-sm font-extrabold">{clusterAppointments.length} appointments</span>
                      </button>
                      {isOpen && (
                        <OverlapPopover
                          appointments={clusterAppointments}
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
                    className={`absolute overflow-hidden rounded-lg border border-beige-300 px-2.5 py-1.5 text-left text-xs shadow-sm outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-rust-600 ${statusStyle.bg}`}
                    style={{
                      top,
                      height,
                      left: `${column * widthPct}%`,
                      width: `calc(${widthPct}% - 4px)`,
                      borderLeftWidth: 3,
                      borderLeftColor:
                        appointment.status === "cancelled" ? "#9C8672" : "#C1694F",
                    }}
                  >
                    <div className="flex items-center gap-1.5 font-extrabold text-brown-900">
                      <span
                        className={`flex-shrink-0 rounded px-1 text-[9px] font-bold ${cfg.badgeClassName}`}
                      >
                        {cfg.badgeText}
                      </span>
                      <span className="min-w-0 truncate">{appointment.patientName}</span>
                    </div>
                    <div className="truncate font-semibold text-brown-600">{formatTime12h(appointment.time)}</div>
                  </button>
                );
              }
            );
          })()}
        </div>
      </div>
    </div>
  );
}
