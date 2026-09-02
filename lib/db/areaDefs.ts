import "server-only";
import { prisma } from "@/lib/db/client";
import type { AreaDef as PrismaAreaDefRow } from "@prisma/client";
import type { AreaDef, SessionType } from "@/types";

// Backs Settings → Treatment Areas — see prisma/schema.prisma's AreaDef
// comment for why deletion is safe here (unlike SessionTypeDef, nothing
// references an AreaDef's id; the chosen name is frozen into each Visit's
// area fields as plain text at selection time).

function toAreaDef(row: PrismaAreaDefRow): AreaDef {
  return {
    id: row.id,
    clinicId: row.clinicId,
    sessionType: row.sessionType,
    name: row.name,
    ...(row.defaultDurationMinutes !== null ? { defaultDurationMinutes: row.defaultDurationMinutes } : {}),
    gstApplicable: row.gstApplicable,
    createdAt: Number(row.createdAt),
  };
}

/** A clinic's treatment areas, optionally narrowed to one session type
 * (e.g. just "qs" for the Q-Switch visit form's Area dropdown). */
export async function getClinicAreaDefs(clinicId: string, sessionType?: SessionType): Promise<AreaDef[]> {
  const rows = await prisma.areaDef.findMany({
    where: { clinicId, ...(sessionType ? { sessionType } : {}) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toAreaDef);
}

export interface AreaDefInput {
  sessionType: SessionType;
  name: string;
  defaultDurationMinutes?: number;
  gstApplicable: boolean;
}

export async function createAreaDef(clinicId: string, input: AreaDefInput): Promise<AreaDef> {
  const row = await prisma.areaDef.create({
    data: {
      clinicId,
      sessionType: input.sessionType,
      name: input.name,
      defaultDurationMinutes: input.defaultDurationMinutes ?? null,
      gstApplicable: input.gstApplicable,
      createdAt: BigInt(Date.now()),
    },
  });
  return toAreaDef(row);
}

export async function updateAreaDef(
  clinicId: string,
  id: string,
  input: Omit<AreaDefInput, "sessionType">
): Promise<AreaDef> {
  const existing = await prisma.areaDef.findUnique({ where: { id }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Treatment area not found.");
  }
  const row = await prisma.areaDef.update({
    where: { id },
    data: {
      name: input.name,
      defaultDurationMinutes: input.defaultDurationMinutes ?? null,
      gstApplicable: input.gstApplicable,
    },
  });
  return toAreaDef(row);
}

export async function deleteAreaDef(clinicId: string, id: string): Promise<void> {
  const existing = await prisma.areaDef.findUnique({ where: { id }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Treatment area not found.");
  }
  await prisma.areaDef.delete({ where: { id } });
}
