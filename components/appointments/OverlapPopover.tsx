"use client";

import { useEffect, useRef } from "react";
import { formatTime12h } from "@/lib/calendar";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import { SCHEDULE_STATUS_STYLE } from "./scheduleStatusStyles";
import type { Appointment } from "@/types";

/** The floating list a cluster's "N appointments" overflow indicator opens
 * — every appointment in that time slot, individually clickable, instead
 * of trying to squeeze them all into illegibly-thin side-by-side slivers.
 * Closes on an outside click or Escape, same as the app's other popovers. */
export default function OverlapPopover({
  appointments,
  onSelect,
  onClose,
  align = "left",
}: {
  appointments: Appointment[];
  onSelect: (appt: Appointment) => void;
  onClose: () => void;
  // "left" opens rightward from the trigger (the default); "right" opens
  // leftward instead, for a trigger near the right edge of the calendar
  // grid where a rightward-opening popover would run off-screen.
  align?: "left" | "right";
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const sorted = [...appointments].sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className={`absolute top-0 z-20 w-56 overflow-hidden rounded-xl border border-beige-300 bg-surface shadow-card ${
        align === "right" ? "right-0" : "left-0"
      }`}
    >
      <div className="border-b border-beige-300 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-brown-400">
        {sorted.length} appointments
      </div>
      <div className="max-h-64 overflow-y-auto">
        {sorted.map((appt) => {
          const cfg = SESSION_TYPE_CONFIG[appt.sessionType];
          const statusStyle = SCHEDULE_STATUS_STYLE[appt.status];
          return (
            <button
              key={appt.id}
              onClick={() => onSelect(appt)}
              className="flex w-full items-center gap-2 border-b border-beige-200 px-3 py-2 text-left text-xs last:border-b-0 hover:bg-beige-100"
            >
              <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${statusStyle.dot}`} />
              <span className="w-14 flex-shrink-0 font-semibold text-brown-600">
                {formatTime12h(appt.time)}
              </span>
              <span
                className={`flex-shrink-0 rounded px-1 text-[9px] font-bold ${cfg.badgeClassName}`}
              >
                {cfg.badgeText}
              </span>
              <span className="min-w-0 truncate font-medium text-brown-900">{appt.patientName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
