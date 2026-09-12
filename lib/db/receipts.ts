import "server-only";
import { prisma } from "@/lib/db/client";
import type { Receipt as PrismaReceiptRow } from "@prisma/client";
import type { Receipt, ReceiptItem } from "@/types";

// Postgres migration, chunk 5 — the Receipt half of prisma/schema.prisma.
// Function names/signatures intentionally match lib/firestore/receipts.ts
// as closely as possible so call-site changes are just the import path.
// Receipt never had an update/delete path even on Firestore (see
// components/documents/ReceiptFormModal.tsx) — only read + create exist
// here too.

const RECEIPTS_PAGE_SIZE = 25;

function toReceipt(row: PrismaReceiptRow): Receipt {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    patientName: row.patientName,
    receiptNumber: row.receiptNumber,
    date: row.date,
    items: row.items as unknown as ReceiptItem[],
    amount: row.amount,
    issuedByUid: row.issuedByUid,
    issuedByName: row.issuedByName,
    createdAt: Number(row.createdAt),
    ...(row.patientPhone ? { patientPhone: row.patientPhone } : {}),
    ...(row.patientAge !== null ? { patientAge: row.patientAge } : {}),
    ...(row.patientGender ? { patientGender: row.patientGender } : {}),
    ...(row.patientAddress ? { patientAddress: row.patientAddress } : {}),
    ...(row.consultingDoctor ? { consultingDoctor: row.consultingDoctor } : {}),
    ...(row.visitId ? { visitId: row.visitId } : {}),
    ...(row.packageId ? { packageId: row.packageId } : {}),
    ...(row.appointmentId ? { appointmentId: row.appointmentId } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
  };
}

/** A single receipt by id, or null if it doesn't exist or belongs to
 * another clinic — used by server actions (e.g. sending a receipt over
 * WhatsApp/SMS) that only have a receiptId, not a full patient/clinic list
 * to scan. */
export async function getReceipt(clinicId: string, receiptId: string): Promise<Receipt | null> {
  const row = await prisma.receipt.findUnique({ where: { id: receiptId } });
  if (!row || row.clinicId !== clinicId) return null;
  return toReceipt(row);
}

/** Receipts for one patient, newest first. */
export async function getPatientReceipts(clinicId: string, patientId: string): Promise<Receipt[]> {
  const rows = await prisma.receipt.findMany({
    where: { clinicId, patientId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toReceipt);
}

/** Every receipt across the whole clinic, in one read. EXPENSIVE at real
 * scale — avoid this for anything that only needs to check a handful of
 * specific appointments (see getReceiptsByAppointmentIds below), which is
 * what the pipeline auto-complete check on Dashboard/Appointments actually
 * needs. The Documents page's receipts *list* uses getClinicReceiptsPage
 * below instead. */
export async function getClinicReceipts(clinicId: string): Promise<Receipt[]> {
  const rows = await prisma.receipt.findMany({ where: { clinicId }, orderBy: { createdAt: "desc" } });
  return rows.map(toReceipt);
}

/** Receipts linked to any of the given appointments — backs the "has this
 * appointment already been receipted?" pipeline check (see
 * lib/overview.ts computeAppointmentPipelineMaps). */
export async function getReceiptsByAppointmentIds(clinicId: string, appointmentIds: string[]): Promise<Receipt[]> {
  const uniqueIds = Array.from(new Set(appointmentIds)).filter(Boolean);
  if (uniqueIds.length === 0) return [];
  const rows = await prisma.receipt.findMany({ where: { clinicId, appointmentId: { in: uniqueIds } } });
  return rows.map(toReceipt);
}

export interface ReceiptsPage {
  receipts: Receipt[];
  nextCursor: string | null;
}

/**
 * One page of the clinic's receipts, newest first — backs the Documents
 * page's Receipts tab so opening it doesn't read every receipt the clinic
 * has ever issued. Cursor is just the last row's id (unique on its own),
 * same reasoning as getPatientsPage in lib/db/patients.ts — no
 * createdAt/id compound tiebreaker needed the way the Firestore version
 * required.
 */
export async function getClinicReceiptsPage(
  clinicId: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<ReceiptsPage> {
  const limit = opts.limit ?? RECEIPTS_PAGE_SIZE;

  const rows = await prisma.receipt.findMany({
    where: { clinicId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });

  const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;
  return { receipts: rows.map(toReceipt), nextCursor };
}

/**
 * Clinic-wide receipt search by patient name or receipt number — unlike
 * getClinicReceiptsPage above, this isn't scoped to whatever page happens
 * to be loaded (see README's "Pagination is partial"). No separate
 * lowercased column needed the way Patient.nameLower exists for prefix
 * search: patientName is already a plain column, and Postgres's
 * case-insensitive `contains` doesn't need an index to be fast at one
 * clinic's actual scale (a handful of thousand rows at most, always
 * pre-filtered by the indexed clinicId first).
 */
export async function searchClinicReceipts(clinicId: string, query: string, limit = 30): Promise<Receipt[]> {
  const q = query.trim();
  if (!q) return [];
  const rows = await prisma.receipt.findMany({
    where: {
      clinicId,
      OR: [
        { patientName: { contains: q, mode: "insensitive" } },
        { receiptNumber: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
  });
  return rows.map(toReceipt);
}

export interface CreateReceiptInput {
  clinicId: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  patientAge?: number;
  patientGender?: string;
  patientAddress?: string;
  consultingDoctor?: string;
  receiptNumber: string;
  date: string;
  items: ReceiptItem[];
  amount: number;
  visitId?: string;
  packageId?: string;
  appointmentId?: string;
  notes?: string;
  issuedByUid: string;
  issuedByName: string;
}

export async function createReceipt(input: CreateReceiptInput): Promise<string> {
  const row = await prisma.receipt.create({
    data: {
      clinicId: input.clinicId,
      patientId: input.patientId,
      patientName: input.patientName,
      patientPhone: input.patientPhone ?? null,
      patientAge: input.patientAge ?? null,
      patientGender: input.patientGender ?? null,
      patientAddress: input.patientAddress ?? null,
      consultingDoctor: input.consultingDoctor ?? null,
      receiptNumber: input.receiptNumber,
      date: input.date,
      items: input.items as unknown as object,
      amount: input.amount,
      visitId: input.visitId ?? null,
      packageId: input.packageId ?? null,
      appointmentId: input.appointmentId ?? null,
      notes: input.notes ?? null,
      issuedByUid: input.issuedByUid,
      issuedByName: input.issuedByName,
      createdAt: BigInt(Date.now()),
    },
  });
  return row.id;
}

/** Returns the patient/receipt-number this receipt belonged to — the
 * caller (receiptActions.ts) only ever has the receipt's own id, not the
 * patient it's under, but needs the patientId to record an audit event
 * against the right patient (see lib/db/auditLog.ts). */
export async function deleteReceipt(
  clinicId: string,
  receiptId: string
): Promise<{ patientId: string; receiptNumber: string; amount: number }> {
  const existing = await prisma.receipt.findUnique({
    where: { id: receiptId },
    select: { clinicId: true, patientId: true, receiptNumber: true, amount: true },
  });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Receipt not found.");
  }
  await prisma.receipt.delete({ where: { id: receiptId } });
  return { patientId: existing.patientId, receiptNumber: existing.receiptNumber, amount: existing.amount };
}
