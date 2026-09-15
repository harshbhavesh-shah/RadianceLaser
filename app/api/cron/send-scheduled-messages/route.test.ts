import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { createClinic } from "@/lib/db/clinics";
import { createPatient } from "@/lib/db/patients";
import { createAppointment } from "@/lib/db/appointments";
import { createVisit } from "@/lib/db/visits";
import { createMessageTemplate } from "@/lib/db/messageTemplates";
import { getWhatsAppConnection, upsertWhatsAppConnection } from "@/lib/db/whatsapp";
import { getClinicNoShowFollowUps, createNoShowFollowUp } from "@/lib/db/noShowFollowUps";
import { getClinic } from "@/lib/db/clinics";
import { getClinicMessageTemplates } from "@/lib/db/messageTemplates";
import { todayLocalStr, toDateStr } from "@/lib/calendar";
import type { NoShowFollowUp } from "@/types";

// The four jobs this cron runs (reminders, feedback surveys, no-show
// auto-detect, no-show follow-ups) had zero automated coverage — the exact
// gap flagged in the Verification Ledger. Real Postgres throughout; only
// the outbound WhatsApp send itself is mocked, since it's a paid external
// API call, not something to actually fire in a test run.
//
// Deliberately does NOT call the route's own GET handler — GET walks
// *every* clinic in the connected database by design (see route.ts's own
// comment), and this repo's DATABASE_URL points at a real, shared
// Postgres instance that also holds a live-connected WhatsApp demo clinic
// ("Lumière Aesthétique"). An earlier version of this test called GET
// directly and it actually flipped/logged real rows for that clinic
// before being caught and reverted. Testing the exported per-clinic
// functions (processReminders, processFeedbackSurveys, autoDetectNoShows,
// processNoShowFollowUps) instead scopes every write to only the
// throwaway clinic each test seeds — nothing here can ever touch another
// clinic's data, no matter what else exists in the database.

const sendTemplateMessage = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/whatsapp/activeProvider", () => ({
  activeProvider: { sendTemplateMessage },
}));
// getClinic (lib/db/clinics.ts) wraps its query in unstable_cache, which
// needs Next's request-scoped incremental cache — not present outside a
// real request. Caching isn't what these tests are about, so just run the
// wrapped function directly, same as app/dashboard/billing/actions.test.ts.
vi.mock("next/cache", () => ({
  unstable_cache:
    <T extends (...args: unknown[]) => unknown>(fn: T) =>
    (...args: Parameters<T>) =>
      fn(...args),
}));

const { GET, processReminders, processFeedbackSurveys, autoDetectNoShows, processNoShowFollowUps } = await import(
  "./route"
);

const TEST_PREFIX = `_test_cron_${Date.now()}`;
const seededClinicIds: string[] = [];

async function purgeClinics(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await prisma.whatsAppConnection.deleteMany({ where: { id: { in: ids } } });
  await prisma.messageTemplate.deleteMany({ where: { clinicId: { in: ids } } });
  await prisma.noShowFollowUp.deleteMany({ where: { clinicId: { in: ids } } });
  await prisma.noShowMessageLog.deleteMany({ where: { clinicId: { in: ids } } });
  await prisma.noShowSurveyResponse.deleteMany({ where: { clinicId: { in: ids } } });
  await prisma.visitFeedback.deleteMany({ where: { clinicId: { in: ids } } });
  await prisma.visit.deleteMany({ where: { clinicId: { in: ids } } });
  await prisma.appointment.deleteMany({ where: { clinicId: { in: ids } } });
  await prisma.patient.deleteMany({ where: { clinicId: { in: ids } } });
  await prisma.clinic.deleteMany({ where: { id: { in: ids } } });
}

async function seedConnectedClinic(overrides: {
  reminderEnabled?: boolean;
  feedbackSurveyEnabled?: boolean;
  feedbackSurveyDelayHours?: number;
} = {}): Promise<string> {
  const clinic = await createClinic({
    name: `${TEST_PREFIX}_${seededClinicIds.length}`,
    subscriptionStatus: "trialing",
    trialEndsAt: Date.now() + 1000 * 60 * 60 * 24 * 30,
  });
  seededClinicIds.push(clinic.id);

  if (overrides.reminderEnabled) {
    await prisma.clinic.update({ where: { id: clinic.id }, data: { reminderEnabled: true, reminderHoursBefore: 24 } });
  }
  if (overrides.feedbackSurveyEnabled) {
    await prisma.clinic.update({
      where: { id: clinic.id },
      data: { feedbackSurveyEnabled: true, feedbackSurveyDelayHours: overrides.feedbackSurveyDelayHours ?? 3 },
    });
  }

  await upsertWhatsAppConnection(clinic.id, {
    phoneNumberId: `_test_phone_${clinic.id}`,
    accessToken: "test-token",
    appSecret: "test-secret",
  });

  return clinic.id;
}

describe("send-scheduled-messages cron (integration, real Postgres; WhatsApp send mocked)", () => {
  beforeAll(async () => {
    // Belt-and-suspenders against a prior crashed run of this exact suite
    // leaving orphaned rows under this prefix pattern.
    const stale = await prisma.clinic.findMany({ where: { name: { startsWith: "_test_cron_" } }, select: { id: true } });
    await purgeClinics(stale.map((c) => c.id));
  });

  afterAll(async () => {
    await purgeClinics(seededClinicIds);
  });

  beforeEach(() => {
    sendTemplateMessage.mockClear();
  });

  it("GET rejects a request without the right bearer token, before touching any clinic", async () => {
    const req = new NextRequest("http://localhost/api/cron/send-scheduled-messages", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(sendTemplateMessage).not.toHaveBeenCalled();
  });

  describe("processReminders", () => {
    it("sends a reminder inside the window and never sends it twice", async () => {
      const clinicId = await seedConnectedClinic({ reminderEnabled: true });
      await createMessageTemplate({
        clinicId,
        name: "appt_reminder_tpl",
        category: "appointment_reminder",
        language: "en",
        variableLabels: ["name", "clinic", "date", "time"],
      });
      const patientId = await createPatient({ clinicId, name: "Reminder Patient", phone: "9111111111" });
      const soon = new Date(Date.now() + 3 * 60 * 60 * 1000); // due in 3h, inside the 24h window
      const appointmentId = await createAppointment({
        clinicId,
        patientId,
        patientName: "Reminder Patient",
        patientPhone: "9111111111",
        sessionType: "qs",
        date: toDateStr(soon),
        time: `${String(soon.getHours()).padStart(2, "0")}:${String(soon.getMinutes()).padStart(2, "0")}`,
        durationMinutes: 30,
        status: "booked",
      });

      const clinic = await getClinic(clinicId);
      const connection = await getWhatsAppConnection(clinicId);
      const templates = await getClinicMessageTemplates(clinicId);

      const firstSent = await processReminders(clinic!, templates, connection!);
      expect(firstSent).toBe(1);
      expect(sendTemplateMessage).toHaveBeenCalledTimes(1);

      const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
      expect(appt?.reminderSentAt).not.toBeNull();

      const secondSent = await processReminders(clinic!, templates, connection!);
      expect(secondSent).toBe(0);
      expect(sendTemplateMessage).toHaveBeenCalledTimes(1);
    });

    it("does not send a reminder for an appointment outside the reminder window", async () => {
      const clinicId = await seedConnectedClinic({ reminderEnabled: true });
      await createMessageTemplate({
        clinicId,
        name: "appt_reminder_tpl_2",
        category: "appointment_reminder",
        language: "en",
        variableLabels: ["name", "clinic", "date", "time"],
      });
      const patientId = await createPatient({ clinicId, name: "Far Future Patient", phone: "9111111112" });
      const farOut = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days out, window is 24h
      await createAppointment({
        clinicId,
        patientId,
        patientName: "Far Future Patient",
        patientPhone: "9111111112",
        sessionType: "qs",
        date: toDateStr(farOut),
        time: "10:00",
        durationMinutes: 30,
        status: "booked",
      });

      const clinic = await getClinic(clinicId);
      const connection = await getWhatsAppConnection(clinicId);
      const templates = await getClinicMessageTemplates(clinicId);

      const sent = await processReminders(clinic!, templates, connection!);
      expect(sent).toBe(0);
      expect(sendTemplateMessage).not.toHaveBeenCalled();
    });
  });

  describe("processFeedbackSurveys", () => {
    it("sends a feedback survey for a visit past its delay window and marks it sent", async () => {
      const clinicId = await seedConnectedClinic({ feedbackSurveyEnabled: true, feedbackSurveyDelayHours: 3 });
      await createMessageTemplate({
        clinicId,
        name: "feedback_tpl",
        category: "visit_feedback",
        language: "en",
        variableLabels: ["name", "link"],
      });
      const patientId = await createPatient({ clinicId, name: "Feedback Patient", phone: "9111111113" });
      const visitId = await createVisit({
        clinicId,
        patientId,
        sessionType: "qs",
        date: todayLocalStr(),
        fields: {},
        areas: [],
      });
      // createVisit always stamps createdAt as "now" — backdate it past the
      // 3h delay so it's actually due, same as a visit logged hours ago.
      await prisma.visit.update({
        where: { id: visitId },
        data: { createdAt: BigInt(Date.now() - 4 * 60 * 60 * 1000) },
      });

      const clinic = await getClinic(clinicId);
      const connection = await getWhatsAppConnection(clinicId);
      const templates = await getClinicMessageTemplates(clinicId);

      const sent = await processFeedbackSurveys(clinic!, templates, connection!);
      expect(sent).toBe(1);
      expect(sendTemplateMessage).toHaveBeenCalledTimes(1);

      const feedback = await prisma.visitFeedback.findFirst({ where: { visitId } });
      expect(feedback?.sentAt).not.toBeNull();
    });

    it("does not survey a visit still inside its delay window", async () => {
      const clinicId = await seedConnectedClinic({ feedbackSurveyEnabled: true, feedbackSurveyDelayHours: 3 });
      await createMessageTemplate({
        clinicId,
        name: "feedback_tpl_2",
        category: "visit_feedback",
        language: "en",
        variableLabels: ["name", "link"],
      });
      const patientId = await createPatient({ clinicId, name: "Too Soon Patient", phone: "9111111118" });
      await createVisit({ clinicId, patientId, sessionType: "qs", date: todayLocalStr(), fields: {}, areas: [] });
      // Left at "now" — well inside the 3h delay window, not due yet.

      const clinic = await getClinic(clinicId);
      const connection = await getWhatsAppConnection(clinicId);
      const templates = await getClinicMessageTemplates(clinicId);

      const sent = await processFeedbackSurveys(clinic!, templates, connection!);
      expect(sent).toBe(0);
      expect(sendTemplateMessage).not.toHaveBeenCalled();
    });
  });

  describe("autoDetectNoShows", () => {
    it("flips a booked appointment well past its end time with no visit logged", async () => {
      const clinicId = await seedConnectedClinic();
      const patientId = await createPatient({ clinicId, name: "No Show Patient", phone: "9111111114" });
      const past = new Date(Date.now() - 5 * 60 * 60 * 1000); // ended hours ago, past the 2h grace
      const appointmentId = await createAppointment({
        clinicId,
        patientId,
        patientName: "No Show Patient",
        patientPhone: "9111111114",
        sessionType: "qs",
        date: toDateStr(past),
        time: `${String(past.getHours()).padStart(2, "0")}:${String(past.getMinutes()).padStart(2, "0")}`,
        durationMinutes: 30,
        status: "booked",
      });

      const flipped = await autoDetectNoShows(clinicId);
      expect(flipped).toBe(1);

      const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
      expect(appt?.status).toBe("no-show");
    });

    it("does not flag a booked appointment that already has a visit logged", async () => {
      const clinicId = await seedConnectedClinic();
      const patientId = await createPatient({ clinicId, name: "Attended Patient", phone: "9111111115" });
      const past = new Date(Date.now() - 5 * 60 * 60 * 1000);
      const appointmentId = await createAppointment({
        clinicId,
        patientId,
        patientName: "Attended Patient",
        patientPhone: "9111111115",
        sessionType: "qs",
        date: toDateStr(past),
        time: `${String(past.getHours()).padStart(2, "0")}:${String(past.getMinutes()).padStart(2, "0")}`,
        durationMinutes: 30,
        status: "booked",
      });
      await createVisit({
        clinicId,
        patientId,
        sessionType: "qs",
        date: toDateStr(past),
        fields: {},
        areas: [],
        appointmentId,
      });

      const flipped = await autoDetectNoShows(clinicId);
      expect(flipped).toBe(0);

      const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
      expect(appt?.status).toBe("booked");
    });
  });

  describe("processNoShowFollowUps", () => {
    async function seedFollowUp(clinicId: string, kind: NoShowFollowUp["kind"], delayHours: number) {
      const template = await createMessageTemplate({
        clinicId,
        name: `no_show_followup_tpl_${kind}`,
        category: "no_show_followup",
        language: "en",
        variableLabels: ["name", "offer"],
      });
      await createNoShowFollowUp(clinicId, {
        name: `${kind} follow-up`,
        kind,
        templateId: template.id,
        offerText: "10% off your next visit",
        enabled: true,
        delayHours,
      });
      return getClinicNoShowFollowUps(clinicId);
    }

    it("sends an incentive follow-up once its own delay has passed, and never repeats it", async () => {
      const clinicId = await seedConnectedClinic();
      const followUps = await seedFollowUp(clinicId, "incentive", 1);
      const patientId = await createPatient({ clinicId, name: "Followup Patient", phone: "9111111116" });
      const endedHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const appointmentId = await createAppointment({
        clinicId,
        patientId,
        patientName: "Followup Patient",
        patientPhone: "9111111116",
        sessionType: "qs",
        date: toDateStr(endedHoursAgo),
        time: `${String(endedHoursAgo.getHours()).padStart(2, "0")}:${String(endedHoursAgo.getMinutes()).padStart(2, "0")}`,
        durationMinutes: 30,
        status: "no-show",
      });

      const clinic = await getClinic(clinicId);
      const connection = await getWhatsAppConnection(clinicId);
      const templates = await getClinicMessageTemplates(clinicId);

      const firstSent = await processNoShowFollowUps(clinic!, followUps, templates, connection!);
      expect(firstSent).toBe(1);

      const log = await prisma.noShowMessageLog.findFirst({ where: { appointmentId } });
      expect(log).not.toBeNull();

      const secondSent = await processNoShowFollowUps(clinic!, followUps, templates, connection!);
      expect(secondSent).toBe(0);
      expect(sendTemplateMessage).toHaveBeenCalledTimes(1);
    });

    it("survives a duplicate/orphaned survey response for the same appointment instead of crashing the whole clinic's pass", async () => {
      // Regression test for a real bug this session found live: a plain
      // `prisma.noShowSurveyResponse.create` (unique on appointmentId)
      // threw when a row already existed from an earlier interrupted
      // attempt, and that throw wasn't caught anywhere in this function —
      // it propagated out and silently broke no-show follow-up processing
      // for the ENTIRE clinic, every single poll, forever. Simulating that
      // pre-existing orphaned row here and confirming the send still
      // succeeds (lib/db/noShowSurvey.ts's createNoShowSurveyResponse now
      // reuses it) is what actually proves the fix.
      const clinicId = await seedConnectedClinic();
      const followUps = await seedFollowUp(clinicId, "survey", 1);
      const patientId = await createPatient({ clinicId, name: "Orphaned Survey Patient", phone: "9111111119" });
      const endedHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const appointmentId = await createAppointment({
        clinicId,
        patientId,
        patientName: "Orphaned Survey Patient",
        patientPhone: "9111111119",
        sessionType: "qs",
        date: toDateStr(endedHoursAgo),
        time: `${String(endedHoursAgo.getHours()).padStart(2, "0")}:${String(endedHoursAgo.getMinutes()).padStart(2, "0")}`,
        durationMinutes: 30,
        status: "no-show",
      });
      // Simulate the orphaned row an earlier crashed/interrupted poll would
      // have left behind, unsent.
      await prisma.noShowSurveyResponse.create({
        data: {
          clinicId,
          appointmentId,
          patientName: "Orphaned Survey Patient",
          token: "_test_orphaned_token",
          createdAt: BigInt(Date.now() - 60 * 60 * 1000),
        },
      });

      const clinic = await getClinic(clinicId);
      const connection = await getWhatsAppConnection(clinicId);
      const templates = await getClinicMessageTemplates(clinicId);

      const sent = await processNoShowFollowUps(clinic!, followUps, templates, connection!);
      expect(sent).toBe(1);
      expect(sendTemplateMessage).toHaveBeenCalledTimes(1);

      const survey = await prisma.noShowSurveyResponse.findUnique({ where: { appointmentId } });
      expect(survey?.token).toBe("_test_orphaned_token"); // reused, not duplicated
      expect(survey?.sentAt).not.toBeNull();
    });
  });
});
