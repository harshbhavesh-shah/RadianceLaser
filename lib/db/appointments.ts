import "server-only";
import { prisma } from "@/lib/db/client";
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
  };
}

/** Every appointment across the whole clinic. */
export async function getClinicAppointments(clinicId: string): Promise<Appointment[]> {
  const rows = await prisma.appointment.findMany({ where: { clinicId } });
  return rows.map(toAppointment);
}

/** Just one day's appointments — backs Dashboard's "Today's Schedule". */
export async function getAppointmentsForDate(clinicId: string, dateStr: string): Promise<Appointment[]> {
  const rows = await prisma.appointment.findMany({ where: { clinicId, date: dateStr } });
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
