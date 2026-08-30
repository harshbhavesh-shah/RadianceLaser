import "server-only";
import { prisma } from "@/lib/db/client";
import type { Machine as PrismaMachineRow } from "@prisma/client";
import type { Machine, MachineStatus, SessionType } from "@/types";

// Postgres migration, chunk 6 — the Machine half of prisma/schema.prisma.
// Function names/signatures intentionally match lib/firestore/machines.ts
// as closely as possible so call-site changes are just the import path.
// Unlike Patient/Visit/Package/Appointment/Receipt, Machine isn't
// patient-scoped — just clinicId — so there's no tenant-check-by-patient
// pattern here, only the usual clinicId match on update/delete.

function toMachine(row: PrismaMachineRow): Machine {
  return {
    id: row.id,
    clinicId: row.clinicId,
    name: row.name,
    sessionType: row.sessionType as SessionType,
    status: row.status as MachineStatus,
    createdAt: Number(row.createdAt),
    ...(row.serialNumber ? { serialNumber: row.serialNumber } : {}),
    ...(row.purchaseDate ? { purchaseDate: row.purchaseDate } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
  };
}

export async function getClinicMachines(clinicId: string): Promise<Machine[]> {
  const rows = await prisma.machine.findMany({
    where: { clinicId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toMachine);
}

export interface MachineInput {
  name: string;
  sessionType: SessionType;
  status: MachineStatus;
  serialNumber?: string;
  purchaseDate?: string;
  notes?: string;
}

export async function createMachine(clinicId: string, input: MachineInput): Promise<string> {
  const row = await prisma.machine.create({
    data: {
      clinicId,
      name: input.name,
      sessionType: input.sessionType,
      status: input.status,
      serialNumber: input.serialNumber ?? null,
      purchaseDate: input.purchaseDate ?? null,
      notes: input.notes ?? null,
      createdAt: BigInt(Date.now()),
    },
  });
  return row.id;
}

export async function updateMachine(clinicId: string, machineId: string, input: MachineInput): Promise<void> {
  const existing = await prisma.machine.findUnique({ where: { id: machineId }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Machine not found.");
  }
  await prisma.machine.update({
    where: { id: machineId },
    data: {
      name: input.name,
      sessionType: input.sessionType,
      status: input.status,
      serialNumber: input.serialNumber ?? null,
      purchaseDate: input.purchaseDate ?? null,
      notes: input.notes ?? null,
    },
  });
}

export async function deleteMachine(clinicId: string, machineId: string): Promise<void> {
  const existing = await prisma.machine.findUnique({ where: { id: machineId }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Machine not found.");
  }
  await prisma.machine.delete({ where: { id: machineId } });
}
