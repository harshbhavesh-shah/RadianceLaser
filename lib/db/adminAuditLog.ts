import "server-only";
import { prisma } from "@/lib/db/client";
import type { AdminAuditLog as PrismaAdminAuditLogRow } from "@prisma/client";
import type { AdminAuditAction, AdminAuditLogEntry } from "@/types";

// Radiance Laser's record of every manual super-admin override — see
// prisma/schema.prisma's AdminAuditLog comment. Not to be confused with
// lib/db/auditLog.ts, which is per-clinic CERT-In/DPDP compliance logging
// for actions clinic staff take on patient data — this is the platform
// operator's own history of Extend/Activate/Terminate/Delete/price
// changes. Append-only: there's no update/delete export here on purpose.

function toEntry(row: PrismaAdminAuditLogRow): AdminAuditLogEntry {
  return {
    id: row.id,
    clinicId: row.clinicId,
    clinicName: row.clinicName,
    action: row.action as AdminAuditAction,
    detail: row.detail,
    performedBy: row.performedBy,
    createdAt: Number(row.createdAt),
  };
}

export interface CreateAdminAuditLogInput {
  clinicId?: string | null;
  clinicName?: string | null;
  action: AdminAuditAction;
  detail: string;
  performedBy: string;
}

export async function createAdminAuditLogEntry(input: CreateAdminAuditLogInput): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      clinicId: input.clinicId ?? null,
      clinicName: input.clinicName ?? null,
      action: input.action,
      detail: input.detail,
      performedBy: input.performedBy,
      createdAt: BigInt(Date.now()),
    },
  });
}

/** Newest first — a log is only useful read chronologically backwards. */
export async function getAdminAuditLogEntries(limit = 200): Promise<AdminAuditLogEntry[]> {
  const rows = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toEntry);
}
