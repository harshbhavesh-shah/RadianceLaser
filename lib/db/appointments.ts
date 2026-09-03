import "server-only";
import { prisma } from "@/lib/db/client";
import { todayLocalStr, addDays, toDateStr } from "@/lib/calendar";
import type { Appointment as PrismaAppointmentRow } from "@prisma/client";
import type { Appointment, AppointmentStatus, SessionType } from "@/types";

// Postgres migration, chunk 4 originally, revised in chunk 15 (going
// Firestore-free) — see prisma/schema.prisma's Appointment model comment
// for the full picture. This is now a clean, single-store module: public
// bookings from the marketing site land here directly (via
// app/api/public/appointments/route.ts) with patientId left null, and
// "linking" one to a patient is just a normal update.

function toAppointment(row: PrismaAppointmentRow): Appointment {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientName: row.patientName,
    patientPhone: row.patientPhone,
    sessionType: row.sessionType as SessionType,
    date: row.date,
    time: row.time,
    durationMinutes: row.durationMinutes,
    status: row.status as AppointmentStatus,
    createdAt: Number(row.createdAt),
    ...(row.patientId ? { patientId: row.patientId } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.reminderSentAt !== null ? { reminderSentAt: Number(row.reminderSentAt) } : {}),
  };
}

/** Every appointment across the whole clinic. */
export async function getClinicAppointments(clinicId: string): Promise<Appointment[]> {
  const rows = await prisma.appointment.findMany({ where: { clinicId } });
  return rows.map(toAppointment);
}

/** Just one day's appointments — backs Dashboard's "Today's Appointments". */
export async function getAppointmentsForDate(clinicId: string, dateStr: string): Promise<Appointment[]> {
  const rows = await prisma.appointment.findMany({ where: { clinicId, date: dateStr } });
  return rows.map(toAppointment);
}

/** Appointments within an inclusive date range — backs Dashboard's "This
 * Week" section. */
export async function getAppointmentsInRange(clinicId: string, startDateStr: string, endDateStr: string): Promise<Appointment[]> {
  const rows = await prisma.appointment.findMany({
    where: { clinicId, date: { gte: startDateStr, lte: endDateStr } },
  });
  return rows.map(toAppointment);
}

/** Whether this clinic has ever booked a single appointment — backs the
 * onboarding checklist's "Book an appointment" step. */
export async function clinicHasAnyAppointment(clinicId: string): Promise<boolean> {
  const row = await prisma.appointment.findFirst({ where: { clinicId }, select: { id: true } });
  return row !== null;
}

export interface AppointmentInput {
  patientId?: string;
  patientName: string;
  patientPhone: string;
  sessionType: SessionType;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  durationMinutes: number;
  status: AppointmentStatus;
  notes?: string;
}

export interface CreateAppointmentInput extends AppointmentInput {
  clinicId: string;
}

export async function createAppointment(input: CreateAppointmentInput): Promise<string> {
  const row = await prisma.appointment.create({
    data: {
      clinicId: input.clinicId,
      patientId: input.patientId ?? null,
      patientName: input.patientName,
      patientPhone: input.patientPhone,
      sessionType: input.sessionType,
      date: input.date,
      time: input.time,
      durationMinutes: input.durationMinutes,
      status: input.status,
      notes: input.notes ?? null,
      createdAt: BigInt(Date.now()),
    },
  });
  return row.id;
}

export async function updateAppointment(clinicId: string, appointmentId: string, input: AppointmentInput): Promise<void> {
  const existing = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Appointment not found.");
  }
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      patientId: input.patientId ?? null,
      patientName: input.patientName,
      patientPhone: input.patientPhone,
      sessionType: input.sessionType,
      date: input.date,
      time: input.time,
      durationMinutes: input.durationMinutes,
      status: input.status,
      notes: input.notes ?? null,
    },
  });
}

export async function deleteAppointment(clinicId: string, appointmentId: string): Promise<void> {
  const existing = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Appointment not found.");
  }
  await prisma.appointment.delete({ where: { id: appointmentId } });
}

/** Links a still-unlinked public booking to a (new-or-existing) patient —
 * used by UnlinkedBookingPanel. Just sets patientId/patientName/
 * patientPhone on the existing row; the appointment keeps its id, unlike
 * the old Firestore "promotion" this replaced. */
export async function linkAppointmentToPatient(
  clinicId: string,
  appointmentId: string,
  patientId: string,
  patientName: string,
  patientPhone: string
): Promise<void> {
  const existing = await prisma.appointment.findUnique({ where: { id: appointmentId }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Appointment not found.");
  }
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { patientId, patientName, patientPhone },
  });
}

/** Flips an appointment's status — used by lib/pipeline.ts's auto-complete
 * check. */
export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus): Promise<void> {
  await prisma.appointment.update({ where: { id: appointmentId }, data: { status } });
}

/** Candidate appointments for the reminder cron: booked, not yet
 * reminded, within the next 2 days. The caller does the exact due-now
 * math against reminderHoursBefore. */
export async function getUpcomingUnremindedAppointments(clinicId: string): Promise<Appointment[]> {
  const today = todayLocalStr();
  const horizon = toDateStr(addDays(new Date(), 2));
  const rows = await prisma.appointment.findMany({
    where: { clinicId, status: "booked", reminderSentAt: null, date: { gte: today, lte: horizon } },
  });
  return rows.map(toAppointment);
}

export async function markReminderSent(appointmentId: string): Promise<void> {
  await prisma.appointment.update({ where: { id: appointmentId }, data: { reminderSentAt: BigInt(Date.now()) } });
}

// How long past its end time an appointment can sit with no Visit logged
// before the cron flips it to "no-show". Generous, so same-day bookkeeping
// lag doesn't get flagged as a miss.
const NO_SHOW_GRACE_MS = 2 * 60 * 60 * 1000;

/** Still-"booked" appointments past their time plus grace, with no Visit
 * logged. Bounded to the last 14 days. */
export async function getStaleBookedAppointments(clinicId: string): Promise<Appointment[]> {
  const today = todayLocalStr();
  const floor = toDateStr(addDays(new Date(), -14));
  const candidates = await prisma.appointment.findMany({
    where: { clinicId, status: "booked", date: { gte: floor, lte: today } },
  });
  if (candidates.length === 0) return [];

  const now = Date.now();
  const overdue = candidates.filter((row) => {
    const endsAt = new Date(`${row.date}T${row.time}:00`).getTime() + row.durationMinutes * 60 * 1000;
    return now - endsAt >= NO_SHOW_GRACE_MS;
  });
  if (overdue.length === 0) return [];

  const visited = await prisma.visit.findMany({
    where: { appointmentId: { in: overdue.map((a) => a.id) } },
    select: { appointmentId: true },
  });
  const visitedIds = new Set(visited.map((v) => v.appointmentId));

  return overdue.filter((row) => !visitedIds.has(row.id)).map(toAppointment);
}

/** "no-show" appointments from the last `sinceDays`. Used by the
 * follow-up cron pass and the no-show list/analytics page. */
export async function getRecentNoShowAppointments(clinicId: string, sinceDays = 30): Promise<Appointment[]> {
  const today = todayLocalStr();
  const floor = toDateStr(addDays(new Date(), -sinceDays));
  const rows = await prisma.appointment.findMany({
    where: { clinicId, status: "no-show", date: { gte: floor, lte: today } },
    orderBy: [{ date: "desc" }, { time: "desc" }],
  });
  return rows.map(toAppointment);
}
