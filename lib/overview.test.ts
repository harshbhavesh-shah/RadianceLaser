import { describe, it, expect } from "vitest";
import { computeTodayAppointments, computeAppointmentPipelineMaps } from "@/lib/overview";
import type { Appointment, Receipt, Visit } from "@/types";

// computeTodayAppointments is the spine of the Dashboard's Today section —
// wrong filtering means staff either miss a real appointment or see one
// that isn't actually today. computeAppointmentPipelineMaps decides whether
// Today/Schedule offer "Log Visit" or "Generate Receipt" for a given
// appointment — wrong, and staff either can't find the button they need or
// see one for a step already done.

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

function makeVisit(overrides: Partial<Visit>): Visit {
  return {
    id: "v",
    clinicId: "c1",
    patientId: "p1",
    sessionType: "lhr",
    date: "2026-06-15",
    fields: {},
    createdAt: 0,
    ...overrides,
  };
}

function makeReceipt(overrides: Partial<Receipt>): Receipt {
  return {
    id: "r",
    clinicId: "c1",
    patientId: "p1",
    patientName: "Test Patient",
    receiptNumber: "RCPT-000001",
    date: "2026-06-15",
    items: [],
    amount: 0,
    issuedByUid: "staff1",
    issuedByName: "Staff Member",
    createdAt: 0,
    ...overrides,
  };
}

describe("computeTodayAppointments", () => {
  it("only includes appointments on the given day, excluding past and future dates", () => {
    const result = computeTodayAppointments(
      [
        makeAppt({ id: "yesterday", date: "2026-06-14" }),
        makeAppt({ id: "today", date: "2026-06-15" }),
        makeAppt({ id: "tomorrow", date: "2026-06-16" }),
      ],
      "2026-06-15"
    );
    expect(result.map((a) => a.id)).toEqual(["today"]);
  });

  it("sorts today's appointments earliest-first regardless of input order", () => {
    const result = computeTodayAppointments(
      [
        makeAppt({ id: "afternoon", time: "15:00" }),
        makeAppt({ id: "morning", time: "09:00" }),
        makeAppt({ id: "noon", time: "12:00" }),
      ],
      "2026-06-15"
    );
    expect(result.map((a) => a.id)).toEqual(["morning", "noon", "afternoon"]);
  });

  it("returns an empty list rather than throwing when nothing is booked today", () => {
    expect(computeTodayAppointments([], "2026-06-15")).toEqual([]);
  });
});

describe("computeAppointmentPipelineMaps", () => {
  it("maps an appointment to its linked visit's id", () => {
    const { visitIdByAppointmentId } = computeAppointmentPipelineMaps(
      [makeVisit({ id: "v1", appointmentId: "appt1" })],
      []
    );
    expect(visitIdByAppointmentId).toEqual({ appt1: "v1" });
  });

  it("a walk-in visit with no appointmentId doesn't appear in the map at all", () => {
    const { visitIdByAppointmentId } = computeAppointmentPipelineMaps([makeVisit({ id: "v1" })], []);
    expect(visitIdByAppointmentId).toEqual({});
  });

  it("keeps the first visit when more than one is somehow linked to the same appointment", () => {
    const { visitIdByAppointmentId } = computeAppointmentPipelineMaps(
      [makeVisit({ id: "v1", appointmentId: "appt1" }), makeVisit({ id: "v2", appointmentId: "appt1" })],
      []
    );
    expect(visitIdByAppointmentId.appt1).toBe("v1");
  });

  it("marks an appointment receipted once a receipt links to it", () => {
    const { receiptedAppointmentIds } = computeAppointmentPipelineMaps(
      [],
      [makeReceipt({ id: "r1", appointmentId: "appt1" })]
    );
    expect(receiptedAppointmentIds).toEqual({ appt1: true });
  });

  it("a receipt not tied to any appointment (e.g. a package sale) leaves the map untouched", () => {
    const { receiptedAppointmentIds } = computeAppointmentPipelineMaps([], [makeReceipt({ id: "r1" })]);
    expect(receiptedAppointmentIds).toEqual({});
  });

  it("a booked appointment with neither a visit nor a receipt appears in neither map — Log Visit is the right action", () => {
    const { visitIdByAppointmentId, receiptedAppointmentIds } = computeAppointmentPipelineMaps([], []);
    expect(visitIdByAppointmentId.apptX).toBeUndefined();
    expect(receiptedAppointmentIds.apptX).toBeUndefined();
  });
});
