import "server-only";
import { prisma } from "@/lib/db/client";
import type { Visit as PrismaVisitRow } from "@prisma/client";
import type { PaymentMethod, SessionType, Visit, VisitAreaEntry } from "@/types";

// Postgres migration, chunk 2 — the Visit half of prisma/schema.prisma's
// Patient+Visit chunk (see that file for why these two collections were
// picked first). Function names/signatures intentionally match
// lib/firestore/visits.ts as closely as possible so call-site changes are
// just the import path, not the call shape. Unlike that module, the "in"
// queries here (getVisitsByAppointmentIds) don't need Firestore's 10-item
// chunking — Postgres has no such limit.

function toVisit(row: PrismaVisitRow): Visit {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    sessionType: row.sessionType as SessionType,
    date: row.date,
    fields: row.fields as Record<string, string | number>,
    createdAt: Number(row.createdAt),
    ...(row.areas ? { areas: row.areas as unknown as VisitAreaEntry[] } : {}),
    ...(row.appointmentId ? { appointmentId: row.appointmentId } : {}),
    ...(row.packageId ? { packageId: row.packageId } : {}),
    ...(row.machineId ? { machineId: row.machineId } : {}),
    ...(row.performedByUid ? { performedByUid: row.performedByUid } : {}),
    ...(row.performedByName ? { performedByName: row.performedByName } : {}),
    ...(row.durationMinutes !== null ? { durationMinutes: row.durationMinutes } : {}),
    ...(row.paymentMethod ? { paymentMethod: row.paymentMethod as PaymentMethod } : {}),
    ...(row.followUpDate ? { followUpDate: row.followUpDate } : {}),
    ...(row.followUpNote ? { followUpNote: row.followUpNote } : {}),
    ...(row.legacyVisitNo !== null ? { legacyVisitNo: row.legacyVisitNo } : {}),
  };
}

/**
 * Fetches every logged visit for a patient, across all session types.
 * Sorting and splitting by sessionType happens client-side, same as the
 * Firestore version this replaces.
 */
export async function getPatientVisits(clinicId: string, patientId: string): Promise<Visit[]> {
  const rows = await prisma.visit.findMany({ where: { clinicId, patientId } });
  return rows.map(toVisit);
}

/**
 * Fetches every visit across the whole clinic. Only the Analytics page
 * should use this — see lib/firestore/visits.ts (the collection this table
 * replaces) for why several of its numbers are deliberately all-time rather
 * than date-scoped. Every other page uses one of the targeted queries below.
 */
export async function getClinicVisits(clinicId: string): Promise<Visit[]> {
  const rows = await prisma.visit.findMany({ where: { clinicId } });
  return rows.map(toVisit);
}

/** Most recently *entered* visits (by createdAt, not visit date) — backs
 * Dashboard's "Recent Activity" feed, which only ever shows a handful. */
export async function getRecentClinicVisits(clinicId: string, limitCount = 8): Promise<Visit[]> {
  const rows = await prisma.visit.findMany({
    where: { clinicId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limitCount,
  });
  return rows.map(toVisit);
}

/** Visits on or after a given date — covers "today/this week/this month"
 * stats and the monthly revenue chart without reading the clinic's entire
 * history. */
export async function getClinicVisitsSince(clinicId: string, sinceDateStr: string): Promise<Visit[]> {
  const rows = await prisma.visit.findMany({ where: { clinicId, date: { gte: sinceDateStr } } });
  return rows.map(toVisit);
}

/** Visits with a follow-up date due (today or earlier) — backs Dashboard's
 * follow-up alerts (see lib/overview.ts computeFollowUpAlerts). A visit
 * with no followUpDate at all is naturally excluded (SQL NULL comparisons
 * never match), not just ones where it's in the future. */
export async function getVisitsWithDueFollowUps(clinicId: string, todayStr: string): Promise<Visit[]> {
  const rows = await prisma.visit.findMany({ where: { clinicId, followUpDate: { lte: todayStr } } });
  return rows.map(toVisit);
}

/** Visits whose follow-up date falls within an inclusive range — backs
 * the Follow-Ups page's Today/Tomorrow lists. Unlike
 * getVisitsWithDueFollowUps above, this is a strict window, not
 * "due or overdue" — a follow-up whose date has already passed without
 * this range catching it simply won't appear here. */
export async function getVisitsWithFollowUpBetween(clinicId: string, startDateStr: string, endDateStr: string): Promise<Visit[]> {
  const rows = await prisma.visit.findMany({
    where: { clinicId, followUpDate: { gte: startDateStr, lte: endDateStr } },
  });
  return rows.map(toVisit);
}

/** Every visit redeemed against one package — exactly what
 * computePackageLedger (lib/packages.ts) actually needs. */
export async function getVisitsByPackageId(clinicId: string, packageId: string): Promise<Visit[]> {
  const rows = await prisma.visit.findMany({ where: { clinicId, packageId } });
  return rows.map(toVisit);
}

/** Visits linked to any of the given appointments — backs the "has this
 * appointment already been logged?" pipeline check (see
 * lib/overview.ts computeAppointmentPipelineMaps). */
export async function getVisitsByAppointmentIds(clinicId: string, appointmentIds: string[]): Promise<Visit[]> {
  const uniqueIds = Array.from(new Set(appointmentIds)).filter(Boolean);
  if (uniqueIds.length === 0) return [];
  const rows = await prisma.visit.findMany({ where: { clinicId, appointmentId: { in: uniqueIds } } });
  return rows.map(toVisit);
}

export interface CreateVisitInput {
  clinicId: string;
  patientId: string;
  sessionType: SessionType;
  date: string; // YYYY-MM-DD
  fields: Record<string, string | number>; // rollup — see lib/visitAreas.ts
  areas: VisitAreaEntry[]; // one or more treated areas/parts for this visit
  appointmentId?: string;
  packageId?: string;
  paymentMethod?: PaymentMethod;
  followUpDate?: string;
  followUpNote?: string;
  machineId?: string;
  performedByUid?: string;
  performedByName?: string;
  durationMinutes?: number;
  /** Set only for visits re-imported from the clinic's old Access system —
   * see prisma/schema.prisma Visit.legacyVisitNo. */
  legacyVisitNo?: number;
}

export async function createVisit(input: CreateVisitInput): Promise<string> {
  const row = await prisma.visit.create({
    data: {
      clinicId: input.clinicId,
      patientId: input.patientId,
      sessionType: input.sessionType,
      date: input.date,
      fields: input.fields,
      areas: input.areas as unknown as object,
      appointmentId: input.appointmentId ?? null,
      packageId: input.packageId ?? null,
      paymentMethod: input.paymentMethod ?? null,
      followUpDate: input.followUpDate ?? null,
      followUpNote: input.followUpNote ?? null,
      machineId: input.machineId ?? null,
      performedByUid: input.performedByUid ?? null,
      performedByName: input.performedByName ?? null,
      durationMinutes: input.durationMinutes ?? null,
      legacyVisitNo: input.legacyVisitNo ?? null,
      createdAt: BigInt(Date.now()),
    },
  });
  return row.id;
}

export interface UpdateVisitInput {
  date: string;
  fields: Record<string, string | number>;
  areas: VisitAreaEntry[];
  packageId?: string;
  paymentMethod?: PaymentMethod;
  followUpDate?: string;
  followUpNote?: string;
  machineId?: string;
  performedByUid?: string;
  performedByName?: string;
  durationMinutes?: number;
}

/** Overwrites an existing visit in place. Every optional field explicitly
 * falls back to `null` when omitted, so clearing one (e.g. unassigning a
 * package) actually clears it instead of leaving the old value behind —
 * same reasoning as updatePatient in lib/db/patients.ts. */
export async function updateVisit(clinicId: string, visitId: string, input: UpdateVisitInput): Promise<void> {
  const existing = await prisma.visit.findUnique({ where: { id: visitId }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Visit not found.");
  }

  await prisma.visit.update({
    where: { id: visitId },
    data: {
      date: input.date,
      fields: input.fields,
      areas: input.areas as unknown as object,
      packageId: input.packageId ?? null,
      paymentMethod: input.paymentMethod ?? null,
      followUpDate: input.followUpDate ?? null,
      followUpNote: input.followUpNote ?? null,
      machineId: input.machineId ?? null,
      performedByUid: input.performedByUid ?? null,
      performedByName: input.performedByName ?? null,
      durationMinutes: input.durationMinutes ?? null,
    },
  });
}

export async function deleteVisit(clinicId: string, visitId: string): Promise<void> {
  const existing = await prisma.visit.findUnique({ where: { id: visitId }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Visit not found.");
  }
  await prisma.visit.delete({ where: { id: visitId } });
}
