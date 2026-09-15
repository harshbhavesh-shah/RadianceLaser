import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db/client";
import type { NoShowSurveyResponse as PrismaNoShowSurveyRow } from "@prisma/client";
import type { NoShowSurveyResponse, NoShowReason } from "@/types";

// Backs the "why didn't you come in" survey at app/no-show-survey/[token].
// Mirrors lib/db/visitFeedback.ts's token pattern.

function toNoShowSurveyResponse(row: PrismaNoShowSurveyRow): NoShowSurveyResponse {
  return {
    id: row.id,
    clinicId: row.clinicId,
    appointmentId: row.appointmentId,
    patientName: row.patientName,
    token: row.token,
    ...(row.reason ? { reason: row.reason as NoShowReason } : {}),
    ...(row.comment ? { comment: row.comment } : {}),
    ...(row.sentAt !== null ? { sentAt: Number(row.sentAt) } : {}),
    ...(row.respondedAt !== null ? { respondedAt: Number(row.respondedAt) } : {}),
    createdAt: Number(row.createdAt),
  };
}

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Creates the survey row with a fresh token before sending. If the send
 * fails, the caller should delete it so it retries.
 *
 * Idempotent on appointmentId (unique in the schema) — a previous poll can
 * have created this row and then crashed before either sending it or
 * rolling it back (e.g. the cron job's own error, a transient DB blip on
 * markNoShowSurveySent/logNoShowMessageSent). Without this, every later
 * poll's plain `create` would throw a unique-constraint error that isn't
 * caught anywhere upstream, permanently breaking no-show follow-up
 * processing for the *whole clinic*, not just this one appointment, since
 * the exception propagates out of the per-clinic loop in the cron route.
 * Reusing the existing unsent row here is what actually lets that
 * appointment's follow-up retry succeed on the next poll instead of
 * failing the same way forever. */
export async function createNoShowSurveyResponse(
  clinicId: string,
  appointmentId: string,
  patientName: string
): Promise<NoShowSurveyResponse> {
  try {
    const row = await prisma.noShowSurveyResponse.create({
      data: { clinicId, appointmentId, patientName, token: generateToken(), createdAt: BigInt(Date.now()) },
    });
    return toNoShowSurveyResponse(row);
  } catch (err) {
    const existing = await prisma.noShowSurveyResponse.findUnique({ where: { appointmentId } });
    if (existing) return toNoShowSurveyResponse(existing);
    throw err;
  }
}

export async function markNoShowSurveySent(id: string): Promise<void> {
  await prisma.noShowSurveyResponse.update({ where: { id }, data: { sentAt: BigInt(Date.now()) } });
}

export async function deleteUnsentNoShowSurveyResponse(id: string): Promise<void> {
  await prisma.noShowSurveyResponse.delete({ where: { id } });
}

/** For the public app/no-show-survey/[token] page. The token, not a
 * session, authorizes access. */
export async function getNoShowSurveyByToken(token: string): Promise<NoShowSurveyResponse | null> {
  const row = await prisma.noShowSurveyResponse.findUnique({ where: { token } });
  return row ? toNoShowSurveyResponse(row) : null;
}

export async function submitNoShowSurveyResponse(token: string, reason: NoShowReason, comment?: string): Promise<void> {
  await prisma.noShowSurveyResponse.update({
    where: { token },
    data: { reason, comment: comment || null, respondedAt: BigInt(Date.now()) },
  });
}

/** Every response for the clinic, for the no show list page's inline
 * reason display. */
export async function getClinicNoShowSurveyResponses(clinicId: string): Promise<NoShowSurveyResponse[]> {
  const rows = await prisma.noShowSurveyResponse.findMany({ where: { clinicId } });
  return rows.map(toNoShowSurveyResponse);
}
