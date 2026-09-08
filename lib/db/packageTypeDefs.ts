import "server-only";
import { prisma } from "@/lib/db/client";
import type { PackageTypeDef as PrismaPackageTypeDefRow } from "@prisma/client";
import type { PackageTypeDef, SessionType } from "@/types";

// Backs app/dashboard/packages — see prisma/schema.prisma's PackageTypeDef
// comment for why deletion is safe (nothing references an id afterward,
// same reasoning as AreaDef in lib/db/areaDefs.ts, which this mirrors).

function toPackageTypeDef(row: PrismaPackageTypeDefRow): PackageTypeDef {
  return {
    id: row.id,
    clinicId: row.clinicId,
    sessionType: row.sessionType,
    name: row.name,
    totalSessions: row.totalSessions,
    suggestedAmount: row.suggestedAmount,
    createdAt: Number(row.createdAt),
  };
}

/** A clinic's package type presets, optionally narrowed to one session
 * type (e.g. just "lhr" for that tab's "New Package" preset picker). */
export async function getClinicPackageTypeDefs(clinicId: string, sessionType?: SessionType): Promise<PackageTypeDef[]> {
  const rows = await prisma.packageTypeDef.findMany({
    where: { clinicId, ...(sessionType ? { sessionType } : {}) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toPackageTypeDef);
}

export interface PackageTypeDefInput {
  sessionType: SessionType;
  name: string;
  totalSessions: number;
  suggestedAmount: number;
}

export async function createPackageTypeDef(clinicId: string, input: PackageTypeDefInput): Promise<PackageTypeDef> {
  const row = await prisma.packageTypeDef.create({
    data: {
      clinicId,
      sessionType: input.sessionType,
      name: input.name,
      totalSessions: input.totalSessions,
      suggestedAmount: input.suggestedAmount,
      createdAt: BigInt(Date.now()),
    },
  });
  return toPackageTypeDef(row);
}

export async function updatePackageTypeDef(
  clinicId: string,
  id: string,
  input: Omit<PackageTypeDefInput, "sessionType">
): Promise<PackageTypeDef> {
  const existing = await prisma.packageTypeDef.findUnique({ where: { id }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Package type not found.");
  }
  const row = await prisma.packageTypeDef.update({
    where: { id },
    data: {
      name: input.name,
      totalSessions: input.totalSessions,
      suggestedAmount: input.suggestedAmount,
    },
  });
  return toPackageTypeDef(row);
}

export async function deletePackageTypeDef(clinicId: string, id: string): Promise<void> {
  const existing = await prisma.packageTypeDef.findUnique({ where: { id }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Package type not found.");
  }
  await prisma.packageTypeDef.delete({ where: { id } });
}
