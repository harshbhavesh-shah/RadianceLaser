import type { Appointment } from "@/types";

export const CALENDAR_START_HOUR = 9; // 9 AM
export const CALENDAR_END_HOUR = 21; // 9 PM
export const PIXELS_PER_HOUR = 64;

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayLocalStr(): string {
  return toDateStr(new Date());
}

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(d: Date): Date {
  const next = new Date(d);
  next.setDate(next.getDate() - next.getDay()); // Sunday start
  next.setHours(0, 0, 0, 0);
  return next;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Full 6-week (42 day) grid for a month view, including the trailing days
 * of the previous/next month needed to fill complete weeks — same approach
 * every calendar UI uses. */
export function getMonthGridDays(anchor: Date): Date[] {
  const firstOfMonth = startOfMonth(anchor);
  const gridStart = startOfWeek(firstOfMonth);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function getWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Vertical pixel offset for a given time within the day grid, clamped to
 * the visible CALENDAR_START_HOUR–CALENDAR_END_HOUR range. */
export function minutesToTop(minutes: number): number {
  const startMinutes = CALENDAR_START_HOUR * 60;
  return ((minutes - startMinutes) / 60) * PIXELS_PER_HOUR;
}

export function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${String(m || 0).padStart(2, "0")} ${period}`;
}

export interface LayoutEvent {
  appointment: Appointment;
  column: number;
  totalColumns: number;
}

/**
 * Classic "meeting rooms" column-packing layout for overlapping
 * appointments on the same day, so they render side-by-side instead of
 * stacking on top of each other. Appointments are assumed to already be
 * filtered to a single day.
 */
export function layoutOverlappingEvents(appointments: Appointment[]): LayoutEvent[] {
  const sorted = [...appointments].sort(
    (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)
  );

  const results: LayoutEvent[] = [];
  let cluster: { appointment: Appointment; start: number; end: number }[] = [];
  let clusterEnd = -Infinity;

  function flushCluster() {
    if (cluster.length === 0) return;
    // Greedily assign each event to the first column whose previous
    // occupant has already ended by the time this one starts.
    const columnEnds: number[] = [];
    const assigned: { appointment: Appointment; column: number }[] = [];

    for (const ev of cluster) {
      let col = columnEnds.findIndex((end) => end <= ev.start);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(ev.end);
      } else {
        columnEnds[col] = ev.end;
      }
      assigned.push({ appointment: ev.appointment, column: col });
    }

    const totalColumns = columnEnds.length;
    for (const a of assigned) {
      results.push({ appointment: a.appointment, column: a.column, totalColumns });
    }
    cluster = [];
  }

  for (const appt of sorted) {
    const start = timeToMinutes(appt.time);
    const end = start + appt.durationMinutes;

    if (cluster.length > 0 && start >= clusterEnd) {
      flushCluster();
      clusterEnd = -Infinity;
    }
    cluster.push({ appointment: appt, start, end });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flushCluster();

  return results;
}

export function formatMonthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function formatWeekLabel(days: Date[]): string {
  const start = days[0];
  const end = days[6];
  const sameMonth = start.getMonth() === end.getMonth();
  const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endStr = end.toLocaleDateString(
    "en-US",
    sameMonth ? { day: "numeric", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" }
  );
  return `${startStr} – ${endStr}`;
}

export function formatDayLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
