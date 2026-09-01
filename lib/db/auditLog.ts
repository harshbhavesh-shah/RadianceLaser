import "server-only";
import { prisma } from "@/lib/db/client";
import type { AuditLog as PrismaAuditLogRow, Prisma } from "@prisma/client";
import type { Session } from "@/types";

// Backs the CERT-In 2022 Directions' ICT-log-retention requirement and
// DPDP's breach-notification/erasure record-keeping — see the compliance
// write-up for the legal reasoning. Every write here is fire-and-forget
// from the caller's perspective (failures are logged, never thrown) so a
// logging hiccup can never block the actual patient-care action it's
// recording.

export interface AuditEvent {
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}

/** Records one audit event, attributed to the given session. Call this
 * right after the mutation it describes succeeds, never before — a failed
 * mutation has nothing to log. */
export async function recordAuditEvent(session: Session, event: AuditEvent): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        clinicId: session.clinicId,
        actorUid: session.uid,
        actorName: session.email ?? session.uid,
        actorRole: session.role,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        metadata: (event.metadata as Prisma.InputJsonValue) ?? undefined,
        createdAt: BigInt(Date.now()),
      },
    });
  } catch (err) {
    // Never let audit logging fail the caller's actual action.
    console.error("Failed to record audit event:", event.action, err);
  }
}

function toAuditLog(row: PrismaAuditLogRow) {
  return {
    id: row.id,
    clinicId: row.clinicId,
    actorUid: row.actorUid,
    actorName: row.actorName,
    actorRole: row.actorRole,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: Number(row.createdAt),
  };
}

/** Recent audit history for a clinic, newest first — backs an eventual
 * Settings → Activity Log view and incident-response investigations. */
export async function getAuditLogs(clinicId: string, opts: { limit?: number } = {}) {
  const rows = await prisma.auditLog.findMany({
    where: { clinicId },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 200,
  });
  return rows.map(toAuditLog);
}

/** Every audit event touching one specific record (e.g. a patient) —
 * backs breach-notification scoping ("who touched this patient's data,
 * and when") and the erasure action's own before-erase record. */
export async function getAuditLogsForTarget(clinicId: string, targetType: string, targetId: string) {
  const rows = await prisma.auditLog.findMany({
    where: { clinicId, targetType, targetId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toAuditLog);
}
