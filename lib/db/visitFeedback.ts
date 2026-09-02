import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db/client";
import type { VisitFeedback as PrismaVisitFeedbackRow } from "@prisma/client";
import type { VisitFeedback } from "@/types";

// Backs the post-visit satisfaction survey — see
// app/api/cron/send-scheduled-messages (creates + sends these) and the
// public app/feedback/[token] page a patient responds from.

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
  // 24 random bytes, base64url — unguessable, URL-safe, no padding to
  // fuss with. This is the only thing the public feedback link carries
  // (see prisma/schema.prisma's VisitFeedback comment for why it's opaque
  // rather than the visit id itself).
  return randomBytes(24).toString("base64url");
}

export interface VisitPendingFeedback {
  visitId: string;
  patientName: string;
  patientPhone: string | null;
}

/** Visits old enough (per the clinic's configured delayHours) to prompt for
 * feedback, that haven't had a request created for them yet, in the last
 * 3 days — a clinic that's had feedback surveys off for longer than that
 * doesn't get a backlog of stale requests dumped on patients the moment
 * it's turned on. */
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

/** Creates the feedback request row (with a fresh token) right before
 * sending its WhatsApp message. If the send then fails, the caller should
 * call deleteUnsentVisitFeedback to roll this back — otherwise the visit
 * would never be retried, since getVisitsPendingFeedback excludes any
 * visit with an existing feedback row regardless of whether it was ever
 * actually sent. */
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

/** Rolls back a just-created row whose send failed — see
 * createVisitFeedback's comment for why this matters. */
export async function deleteUnsentVisitFeedback(id: string): Promise<void> {
  await prisma.visitFeedback.delete({ where: { id } });
}

/** For the public app/feedback/[token] page — deliberately doesn't take a
 * clinicId, since the token itself (not a session) is what authorizes
 * access here. */
export async function getVisitFeedbackByToken(token: string): Promise<VisitFeedback | null> {
  const row = await prisma.visitFeedback.findUnique({ where: { token } });
  return row ? toVisitFeedback(row) : null;
}

/** Records the patient's response. Safe to call even if already responded
 * — a resubmit just overwrites, rather than erroring, since there's no
 * harm in a patient changing their mind before closing the page. */
export async function submitVisitFeedback(token: string, rating: number, comment?: string): Promise<void> {
  await prisma.visitFeedback.update({
    where: { token },
    data: { rating, comment: comment || null, respondedAt: BigInt(Date.now()) },
  });
}

/** Recent responses for Settings > Communication's results list — newest
 * first, only ones the patient has actually answered. */
export async function getClinicVisitFeedback(clinicId: string, limit = 50): Promise<VisitFeedback[]> {
  const rows = await prisma.visitFeedback.findMany({
    where: { clinicId, respondedAt: { not: null } },
    orderBy: { respondedAt: "desc" },
    take: limit,
  });
  return rows.map(toVisitFeedback);
}
