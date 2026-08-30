import "server-only";
import { prisma } from "@/lib/db/client";
import type { PatientPhoto as PrismaPatientPhotoRow } from "@prisma/client";
import type { PatientPhoto, SessionType } from "@/types";

// Postgres migration, chunk 10 — the PatientPhoto half of
// prisma/schema.prisma. Function names/signatures intentionally match
// lib/firestore/patientPhotos.ts as closely as possible.

function toPatientPhoto(row: PrismaPatientPhotoRow): PatientPhoto {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    dataUrl: row.dataUrl,
    sensitive: row.sensitive,
    uploadedByUid: row.uploadedByUid,
    uploadedByName: row.uploadedByName,
    createdAt: Number(row.createdAt),
    ...(row.visitId ? { visitId: row.visitId } : {}),
    ...(row.sessionType ? { sessionType: row.sessionType as SessionType } : {}),
    ...(row.area ? { area: row.area } : {}),
    ...(row.date ? { date: row.date } : {}),
    ...(row.label ? { label: row.label } : {}),
  };
}

/** All before/after photos logged for a patient, newest first. */
export async function getPatientPhotos(clinicId: string, patientId: string): Promise<PatientPhoto[]> {
  const rows = await prisma.patientPhoto.findMany({
    where: { clinicId, patientId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toPatientPhoto);
}

export interface CreatePatientPhotoInput {
  clinicId: string;
  patientId: string;
  visitId?: string;
  sessionType?: SessionType;
  area?: string;
  date?: string;
  dataUrl: string;
  label?: string;
  sensitive: boolean;
  uploadedByUid: string;
  uploadedByName: string;
}

export async function createPatientPhoto(input: CreatePatientPhotoInput): Promise<PatientPhoto> {
  const row = await prisma.patientPhoto.create({
    data: {
      clinicId: input.clinicId,
      patientId: input.patientId,
      visitId: input.visitId ?? null,
      sessionType: input.sessionType ?? null,
      area: input.area ?? null,
      date: input.date ?? null,
      dataUrl: input.dataUrl,
      label: input.label ?? null,
      sensitive: input.sensitive,
      uploadedByUid: input.uploadedByUid,
      uploadedByName: input.uploadedByName,
      createdAt: BigInt(Date.now()),
    },
  });
  return toPatientPhoto(row);
}

export async function deletePatientPhoto(clinicId: string, id: string): Promise<void> {
  const existing = await prisma.patientPhoto.findUnique({ where: { id }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Photo not found.");
  }
  await prisma.patientPhoto.delete({ where: { id } });
}
