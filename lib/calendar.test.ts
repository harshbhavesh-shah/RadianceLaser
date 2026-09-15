import { describe, it, expect } from "vitest";
import { timeToMinutes, minutesToTop, getWeekDays, getMonthGridDays, layoutOverlappingEvents, toDateStr } from "@/lib/calendar";
import type { Appointment } from "@/types";

// The scheduling views (Day/Week/Month) are the first thing everyone in a
// clinic looks at each morning — a bug here is either a silently wrong grid
// (an appointment on the wrong day) or two appointments rendered stacked on
// top of each other, hiding one from staff entirely.

function makeAppt(overrides: Partial<Appointment>): Appointment {
  return {
    id: "a",
    clinicId: "c1",
    patientId: "p1",
    patientName: "Test Patient",
    patientPhone: "9876543210",
    sessionType: "lhr",
    date: "2026-06-15",
    time: "10:00",
    durationMinutes: 30,
    status: "booked",
    createdAt: 0,
    ...overrides,
  };
}

describe("timeToMinutes", () => {
  it("converts HH:MM to minutes since midnight", () => {
    expect(timeToMinutes("09:00")).toBe(540);
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("23:59")).toBe(1439);
  });
});

describe("minutesToTop", () => {
  it("is 0 at the calendar's start hour", () => {
    expect(minutesToTop(9 * 60)).toBe(0);
  });

  it("is one full PIXELS_PER_HOUR after the start hour", () => {
    expect(minutesToTop(10 * 60)).toBe(64);
  });
});

describe("getWeekDays", () => {
  it("always returns 7 days starting on Sunday, regardless of which day of the week the anchor is", () => {
    // 2026-06-15 is a Monday.
    const days = getWeekDays(new Date(2026, 5, 15));
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(0); // Sunday
    expect(toDateStr(days[0])).toBe("2026-06-14");
    expect(toDateStr(days[6])).toBe("2026-06-20");
  });

  it("an anchor that's already a Sunday stays the week's own start, not the previous week", () => {
    const sunday = new Date(2026, 5, 14);
    const days = getWeekDays(sunday);
    expect(toDateStr(days[0])).toBe("2026-06-14");
  });
});

describe("getMonthGridDays", () => {
  it("always returns a full 42-day (6-week) grid", () => {
    expect(getMonthGridDays(new Date(2026, 5, 15))).toHaveLength(42);
  });

  it("the grid starts on the Sunday on/before the 1st of the month", () => {
    // June 2026 starts on a Monday, so the grid should start Sun May 31.
    const days = getMonthGridDays(new Date(2026, 5, 15));
    expect(toDateStr(days[0])).toBe("2026-05-31");
    expect(days[0].getDay()).toBe(0);
  });
});

describe("layoutOverlappingEvents", () => {
  it("gives a single non-overlapping appointment its own full-width column", () => {
    const result = layoutOverlappingEvents([makeAppt({ time: "10:00", durationMinutes: 30 })]);
    expect(result).toHaveLength(1);
    expect(result[0].column).toBe(0);
    expect(result[0].totalColumns).toBe(1);
  });

  it("two back-to-back (non-overlapping) appointments both get their own full-width column", () => {
    const result = layoutOverlappingEvents([
      makeAppt({ id: "a1", time: "10:00", durationMinutes: 30 }),
      makeAppt({ id: "a2", time: "10:30", durationMinutes: 30 }),
    ]);
    expect(result.every((r) => r.totalColumns === 1)).toBe(true);
  });

  it("two genuinely overlapping appointments split into two side-by-side columns", () => {
    const result = layoutOverlappingEvents([
      makeAppt({ id: "a1", time: "10:00", durationMinutes: 60 }),
      makeAppt({ id: "a2", time: "10:30", durationMinutes: 30 }),
    ]);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.totalColumns === 2)).toBe(true);
    expect(new Set(result.map((r) => r.column)).size).toBe(2); // different columns
  });

  it("a third appointment overlapping both of an existing pair gets a third column", () => {
    const result = layoutOverlappingEvents([
      makeAppt({ id: "a1", time: "10:00", durationMinutes: 60 }),
      makeAppt({ id: "a2", time: "10:00", durationMinutes: 60 }),
      makeAppt({ id: "a3", time: "10:00", durationMinutes: 60 }),
    ]);
    expect(result.every((r) => r.totalColumns === 3)).toBe(true);
    expect(new Set(result.map((r) => r.column)).size).toBe(3);
  });

  it("reuses a freed-up column once its previous occupant has ended, instead of always growing wider", () => {
    // a1 10:00-10:30, a2 10:00-11:00 (overlaps a1), a3 10:30-11:00 (a1 has
    // ended by then, so a3 should reuse a1's column rather than opening a third).
    const result = layoutOverlappingEvents([
      makeAppt({ id: "a1", time: "10:00", durationMinutes: 30 }),
      makeAppt({ id: "a2", time: "10:00", durationMinutes: 60 }),
      makeAppt({ id: "a3", time: "10:30", durationMinutes: 30 }),
    ]);
    expect(result.every((r) => r.totalColumns === 2)).toBe(true);
    const a1 = result.find((r) => r.appointment.id === "a1")!;
    const a3 = result.find((r) => r.appointment.id === "a3")!;
    expect(a3.column).toBe(a1.column);
  });

  it("two separate, non-overlapping clusters on the same day are laid out independently", () => {
    const result = layoutOverlappingEvents([
      makeAppt({ id: "morning1", time: "09:00", durationMinutes: 30 }),
      makeAppt({ id: "morning2", time: "09:00", durationMinutes: 30 }),
      makeAppt({ id: "afternoon", time: "15:00", durationMinutes: 30 }),
    ]);
    const afternoon = result.find((r) => r.appointment.id === "afternoon")!;
    // The afternoon appointment is its own cluster, unaffected by the
    // two-wide morning cluster it doesn't overlap with at all.
    expect(afternoon.totalColumns).toBe(1);
  });

  it("is stable regardless of the input array's order", () => {
    const inOrder = layoutOverlappingEvents([
      makeAppt({ id: "a1", time: "10:00", durationMinutes: 30 }),
      makeAppt({ id: "a2", time: "10:15", durationMinutes: 30 }),
    ]);
    const reversed = layoutOverlappingEvents([
      makeAppt({ id: "a2", time: "10:15", durationMinutes: 30 }),
      makeAppt({ id: "a1", time: "10:00", durationMinutes: 30 }),
    ]);
    expect(inOrder.map((r) => r.appointment.id).sort()).toEqual(reversed.map((r) => r.appointment.id).sort());
    expect(inOrder.every((r) => r.totalColumns === 2)).toBe(true);
    expect(reversed.every((r) => r.totalColumns === 2)).toBe(true);
  });
});
