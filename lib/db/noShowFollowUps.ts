import "server-only";
import { prisma } from "@/lib/db/client";
import type { NoShowFollowUp as PrismaNoShowFollowUpRow } from "@prisma/client";
import type { NoShowFollowUp, NoShowFollowUpKind } from "@/types";

// CRUD for a clinic's no-show follow-ups. Deletion is safe: nothing
// references a follow-up's id except NoShowMessageLog rows, which are
// just history and fine to leave orphaned.

function toNoShowFollowUp(row: PrismaNoShowFollowUpRow): NoShowFollowUp {
  return {
    id: row.id,
    clinicId: row.clinicId,
    name: row.name,
    kind: row.kind as NoShowFollowUpKind,
    templateId: row.templateId,
    ...(row.offerText ? { offerText: row.offerText } : {}),
    enabled: row.enabled,
    delayHours: row.delayHours,
    createdAt: Number(row.createdAt),
  };
}

export async function getClinicNoShowFollowUps(clinicId: string): Promise<NoShowFollowUp[]> {
  const rows = await prisma.noShowFollowUp.findMany({
    where: { clinicId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toNoShowFollowUp);
}

export interface NoShowFollowUpInput {
  name: string;
  kind: NoShowFollowUpKind;
  templateId: string;
  offerText?: string;
  enabled: boolean;
  delayHours: number;
}

export async function createNoShowFollowUp(clinicId: string, input: NoShowFollowUpInput): Promise<NoShowFollowUp> {
  const row = await prisma.noShowFollowUp.create({
    data: {
      clinicId,
      name: input.name,
      kind: input.kind,
      templateId: input.templateId,
      offerText: input.offerText ?? null,
      enabled: input.enabled,
      delayHours: input.delayHours,
      createdAt: BigInt(Date.now()),
    },
  });
  return toNoShowFollowUp(row);
}

export async function updateNoShowFollowUp(
  clinicId: string,
  id: string,
  input: NoShowFollowUpInput
): Promise<NoShowFollowUp> {
  const existing = await prisma.noShowFollowUp.findUnique({ where: { id }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Follow-up not found.");
  }
  const row = await prisma.noShowFollowUp.update({
    where: { id },
    data: {
      name: input.name,
      kind: input.kind,
      templateId: input.templateId,
      offerText: input.offerText ?? null,
      enabled: input.enabled,
      delayHours: input.delayHours,
    },
  });
  return toNoShowFollowUp(row);
}

export async function deleteNoShowFollowUp(clinicId: string, id: string): Promise<void> {
  const existing = await prisma.noShowFollowUp.findUnique({ where: { id }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Follow-up not found.");
  }
  // Its NoShowMessageLog rows stay in place, so send history is still
  // answerable after the follow-up is removed.
  await prisma.noShowFollowUp.delete({ where: { id } });
}
