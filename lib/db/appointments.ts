import "server-only";
import { prisma } from "@/lib/db/client";
import { adminDb } from "@/lib/firebase/admin";
import type { Appointment as PrismaAppointmentRow } from "@prisma/client";
import type { Appointment, AppointmentStatus, SessionType } from "@/types";

// Postgres migration, chunk 4 — see prisma/schema.prisma's Appointment
// model comment for the one wrinkle this chunk has that Patient/Visit/
// Package didn't: the marketing site's public booking form writes straight
// into Firestore, outside this app entirely, so this module is genuinely
// hybrid rather than a clean swap. Every exported read here merges this
// table with Firestore's still-unlinked public bookings; every exported
// write only ever touches one store, picking the right one per call.

function toAppointment(row: PrismaAppointmentRow): Appointment {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    patientName: row.patientName,
    patientPhone: row.patientPhone,
    sessionType: row.sessionType as SessionType,
    date: row.date,
    time: row.time,
    durationMinutes: row.durationMinutes,
    status: row.status as AppointmentStatus,
    createdAt: Number(row.createdAt),
    ...(row.notes ? { notes: row.notes } : {}),
  };
}

/** Publicly-booked appointments still sitting in Firestore, not yet
 * promoted into this table — always patientId: "" (the only shape
 * firestore.rules' isValidPublicLhrBooking allows an anonymous write to
 * create). See promoteAppointment below for how they leave this list. */
async function getUnlinkedPublicBookings(clinicId: string): Promise<Appointment[]> {
  const snap = await adminDb()
    .collection("appointments")
    .where("clinicId", "==", clinicId)
    .where("patientId", "==", "")
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Appointment);
}

/** Every appointment across the whole clinic — this table's rows plus any
 * still-unlinked public bookings, so the calendar/list views show both
 * without staff having to know which store an appointment actually lives
 * in. */
export async function getClinicAppointments(clinicId: string): Promise<Appointment[]> {
  const [rows, publicBookings] = await Promise.all([
    prisma.appointment.findMany({ where: { clinicId } }),
    getUnlinkedPublicBookings(clinicId),
  ]);
  return [...rows.map(toAppointment), ...publicBookings];
}

/** Just one day's appointments — backs Dashboard's "Today's Schedule". */
export async function getAppointmentsForDate(clinicId: string, dateStr: string): Promise<Appointment[]> {
  const [rows, publicBookings] = await Promise.all([
    prisma.appointment.findMany({ where: { clinicId, date: dateStr } }),
    getUnlinkedPublicBookings(clinicId),
  ]);
  return [...rows.map(toAppointment), ...publicBookings.filter((a) => a.date === dateStr)];
}

/** Whether this clinic has ever booked a single appointment — backs the
 * onboarding checklist's "Book an appointment" step. */
export async function clinicHasAnyAppointment(clinicId: string): Promise<boolean> {
  const row = await prisma.appointment.findFirst({ where: { clinicId }, select: { id: true } });
  if (row) return true;
  const publicBookings = await getUnlinkedPublicBookings(clinicId);
  return publicBookings.length > 0;
}

export interface AppointmentInput {
  patientId: string;
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
      patientId: input.patientId,
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
      patientId: input.patientId,
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

/** Deletes a still-unlinked public booking directly from Firestore —
 * used when staff discards one (e.g. a bogus/duplicate online booking)
 * without ever linking it to a patient, so it never gets promoted at all. */
export async function deleteUnlinkedPublicBooking(firestoreId: string): Promise<void> {
  await adminDb().collection("appointments").doc(firestoreId).delete();
}

/** Moves a publicly-booked Firestore appointment into this table — called
 * the first time staff actually touches one, whether that's linking it to
 * a patient (UnlinkedBookingPanel) or editing/saving it directly
 * (AppointmentFormModal). Creates the Postgres row with the finalized
 * fields, then deletes the Firestore doc so it stops showing up in
 * getUnlinkedPublicBookings. The promoted appointment gets a fresh
 * Postgres-native id rather than keeping the Firestore one — nothing
 * downstream depends on an unlinked public booking's id staying stable,
 * since Visit.appointmentId is only ever set once a real patientId already
 * exists (i.e. after promotion). Callers must use the returned id, not the
 * `firestoreId` they passed in. */
export async function promoteAppointment(firestoreId: string, input: CreateAppointmentInput): Promise<string> {
  const id = await createAppointment(input);
  await deleteUnlinkedPublicBooking(firestoreId);
  return id;
}

/** Flips an appointment's status — used by lib/pipeline.ts's auto-complete
 * check. Always a Postgres row: a visit can only ever be logged against an
 * appointment that already has a real patientId, which means it's already
 * been promoted out of Firestore by that point. */
export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus): Promise<void> {
  await prisma.appointment.update({ where: { id: appointmentId }, data: { status } });
}
