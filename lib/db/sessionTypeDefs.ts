import "server-only";
import { prisma } from "@/lib/db/client";
import type { SessionTypeDef as PrismaSessionTypeDefRow } from "@prisma/client";
import type { SessionColumnDef, SessionTypeDef } from "@/types";

// Postgres migration, chunk 8 — the SessionTypeDef half of
// prisma/schema.prisma. Function names/signatures intentionally match
// lib/firestore/sessionTypeDefs.ts as closely as possible. No delete path
// exists here either — same as on the Firestore version (see
// components/settings/MachineTypeFormModal.tsx: a type is only ever
// created or edited in place, never removed, since Visits/Machines
// reference its key).

function toSessionTypeDef(row: PrismaSessionTypeDefRow): SessionTypeDef {
  return {
    id: row.id,
    clinicId: row.clinicId,
    key: row.key,
    label: row.label,
    badgeText: row.badgeText,
    badgeClassName: row.badgeClassName,
    chartColor: row.chartColor,
    columns: row.columns as unknown as SessionColumnDef[],
    createdAt: Number(row.createdAt),
  };
}

/** Clinic-defined major machine types (e.g. "CO2 Laser") — on top of the
 * built-in Q-Switch/LHR types. See lib/sessionTypes.ts for how these get
 * merged into the effective config used across the app. */
export async function getClinicSessionTypeDefs(clinicId: string): Promise<SessionTypeDef[]> {
  const rows = await prisma.sessionTypeDef.findMany({
    where: { clinicId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toSessionTypeDef);
}

export interface SessionTypeDefInput {
  key: string;
  label: string;
  badgeText: string;
  badgeClassName: string;
  chartColor: string;
  columns: SessionColumnDef[];
}

export async function createSessionTypeDef(clinicId: string, input: SessionTypeDefInput): Promise<SessionTypeDef> {
  const row = await prisma.sessionTypeDef.create({
    data: {
      clinicId,
      key: input.key,
      label: input.label,
      badgeText: input.badgeText,
      badgeClassName: input.badgeClassName,
      chartColor: input.chartColor,
      columns: input.columns as unknown as object,
      createdAt: BigInt(Date.now()),
    },
  });
  return toSessionTypeDef(row);
}

export async function updateSessionTypeDef(
  clinicId: string,
  id: string,
  input: Omit<SessionTypeDefInput, "key">
): Promise<SessionTypeDef> {
  const existing = await prisma.sessionTypeDef.findUnique({ where: { id }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Machine type not found.");
  }
  const row = await prisma.sessionTypeDef.update({
    where: { id },
    data: {
      label: input.label,
      badgeText: input.badgeText,
      badgeClassName: input.badgeClassName,
      chartColor: input.chartColor,
      columns: input.columns as unknown as object,
    },
  });
  return toSessionTypeDef(row);
}
