import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db/client";
import type { VisitFeedback as PrismaVisitFeedbackRow } from "@prisma/client";
import type { VisitFeedback } from "@/types";

// Backs the post-visit satisfaction survey at app/feedback/[token].

function toVisitFeedback(row: PrismaVisitFeedbackRow): VisitFeedback {
  return {
    id: row.id,
    clinicId: row.clinicId,
    visitId: row.visitId,
    patientName: row.patientName,
    token: row.token,
    ...(row.rating !== null ? { rating: row.rating } : {}),
    ...(row.comment ? { comment: row.comment } : {}),
    ...(row.sentAt !== null ? { sentAt: Number(row.sentAt) } : {}),
    ...(row.respondedAt !== null ? { respondedAt: Number(row.respondedAt) } : {}),
    createdAt: Number(row.createdAt),
  };
}

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

export interface VisitPendingFeedback {
  visitId: string;
  patientName: string;
  patientPhone: string | null;
}

/** Visits old enough to prompt for feedback, without a request yet, in
 * the last 3 days. */
export async function getVisitsPendingFeedback(clinicId: string, delayHours: number): Promise<VisitPendingFeedback[]> {
  const now = Date.now();
  const cutoff = now - delayHours * 60 * 60 * 1000;
  const floor = now - 3 * 24 * 60 * 60 * 1000;

  const rows = await prisma.visit.findMany({
    where: {
      clinicId,
      createdAt: { gte: BigInt(floor), lte: BigInt(cutoff) },
      feedback: { is: null },
    },
    select: {
      id: true,
      patient: { select: { name: true, phone: true } },
    },
  });

  return rows.map((row) => ({
    visitId: row.id,
    patientName: row.patient.name,
    patientPhone: row.patient.phone || null,
  }));
}

/** Creates the feedback row with a fresh token before sending. If the send
 * fails, call deleteUnsentVisitFeedback to roll it back so it retries. */
export async function createVisitFeedback(
  clinicId: string,
  visitId: string,
  patientName: string
): Promise<VisitFeedback> {
  const row = await prisma.visitFeedback.create({
    data: { clinicId, visitId, patientName, token: generateToken(), createdAt: BigInt(Date.now()) },
  });
  return toVisitFeedback(row);
}

export async function markFeedbackSent(id: string): Promise<void> {
  await prisma.visitFeedback.update({ where: { id }, data: { sentAt: BigInt(Date.now()) } });
}

/** Rolls back a just-created row whose send failed. */
export async function deleteUnsentVisitFeedback(id: string): Promise<void> {
  await prisma.visitFeedback.delete({ where: { id } });
}

/** For the public app/feedback/[token] page. The token itself, not a
 * session, is what authorizes access. */
export async function getVisitFeedbackByToken(token: string): Promise<VisitFeedback | null> {
  const row = await prisma.visitFeedback.findUnique({ where: { token } });
  return row ? toVisitFeedback(row) : null;
}

/** Records the patient's response. A resubmit just overwrites. */
export async function submitVisitFeedback(token: string, rating: number, comment?: string): Promise<void> {
  await prisma.visitFeedback.update({
    where: { token },
    data: { rating, comment: comment || null, respondedAt: BigInt(Date.now()) },
  });
}

/** Recent responses for Settings > Communication's results list. Newest
 * first, only ones the patient has actually answered. */
export async function getClinicVisitFeedback(clinicId: string, limit = 50): Promise<VisitFeedback[]> {
  const rows = await prisma.visitFeedback.findMany({
    where: { clinicId, respondedAt: { not: null } },
    orderBy: { respondedAt: "desc" },
    take: limit,
  });
  return rows.map(toVisitFeedback);
}
