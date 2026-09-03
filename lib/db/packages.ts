import "server-only";
import { prisma } from "@/lib/db/client";
import type { Package as PrismaPackageRow } from "@prisma/client";
import type { Package, PaymentMethod, SessionType } from "@/types";

// Postgres migration, chunk 3 — the Package half of prisma/schema.prisma.
// Function names/signatures intentionally match lib/firestore/packages.ts
// as closely as possible so call-site changes are just the import path.
// Package never had an update/delete path even on Firestore (see
// components/PackageFormModal.tsx) — only read + create exist here too.

function toPackage(row: PrismaPackageRow): Package {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    sessionType: row.sessionType as SessionType,
    label: row.label,
    totalSessions: row.totalSessions,
    totalAmount: row.totalAmount,
    purchaseDate: row.purchaseDate,
    createdAt: Number(row.createdAt),
    ...(row.expiryDate ? { expiryDate: row.expiryDate } : {}),
    ...(row.paymentMethod ? { paymentMethod: row.paymentMethod as PaymentMethod } : {}),
  };
}

export async function getPatientPackages(clinicId: string, patientId: string): Promise<Package[]> {
  const rows = await prisma.package.findMany({ where: { clinicId, patientId } });
  return rows.map(toPackage);
}

/** Every package across the whole clinic — used by the clinic-wide
 * Packages list and by revenue analytics (a package purchase counts as
 * revenue on its purchase date). */
export async function getClinicPackages(clinicId: string): Promise<Package[]> {
  const rows = await prisma.package.findMany({ where: { clinicId } });
  return rows.map(toPackage);
}

/** Packages purchased on or after a date — backs Dashboard's revenue
 * figure, which only needs this month's purchases, not the clinic's whole
 * package history. */
export async function getPackagesPurchasedSince(clinicId: string, sinceDateStr: string): Promise<Package[]> {
  const rows = await prisma.package.findMany({ where: { clinicId, purchaseDate: { gte: sinceDateStr } } });
  return rows.map(toPackage);
}

export interface CreatePackageInput {
  clinicId: string;
  patientId: string;
  sessionType: SessionType;
  label: string;
  totalSessions: number;
  totalAmount: number;
  purchaseDate: string; // YYYY-MM-DD
  expiryDate?: string;
  paymentMethod?: PaymentMethod;
}

export async function createPackage(input: CreatePackageInput): Promise<string> {
  const row = await prisma.package.create({
    data: {
      clinicId: input.clinicId,
      patientId: input.patientId,
      sessionType: input.sessionType,
      label: input.label,
      totalSessions: input.totalSessions,
      totalAmount: input.totalAmount,
      purchaseDate: input.purchaseDate,
      expiryDate: input.expiryDate ?? null,
      paymentMethod: input.paymentMethod ?? null,
      createdAt: BigInt(Date.now()),
    },
  });
  return row.id;
}
