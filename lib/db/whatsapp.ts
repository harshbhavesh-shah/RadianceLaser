import "server-only";
import { prisma } from "@/lib/db/client";
import { normalizePhone } from "@/lib/phone";
import type { WhatsAppConnection as PrismaWhatsAppConnectionRow } from "@prisma/client";
import type { WhatsAppConnection, WhatsAppConnectionStatus } from "@/types";

// Postgres migration, chunk 14 (post-launch cleanup) — WhatsAppConnection,
// migrated in its current BhashSMS shape (see prisma/schema.prisma's model
// comment for why). Function names/signatures intentionally match
// lib/firestore/whatsapp.ts as closely as possible.

function toConnection(row: PrismaWhatsAppConnectionRow): WhatsAppConnection {
  return {
    id: row.id,
    clinicId: row.id,
    status: row.status as WhatsAppConnectionStatus,
    bhashUser: row.bhashUser,
    senderId: row.senderId,
    updatedAt: Number(row.updatedAt),
    ...(row.bhashPass ? { bhashPass: row.bhashPass } : {}),
    ...(row.phoneNumber ? { phoneNumber: row.phoneNumber } : {}),
    ...(row.lastError ? { lastError: row.lastError } : {}),
    ...(row.connectedAt !== null ? { connectedAt: Number(row.connectedAt) } : {}),
  };
}

/** Finds which clinic a WhatsApp number belongs to — how an inbound
 * webhook event (which only knows the receiving number, not a clinicId)
 * gets routed. A full scan over connected accounts rather than a
 * normalized-column query: there's one row per clinic here, not per
 * patient, so this table stays small enough that it doesn't need the same
 * indexed-column treatment as findPatientByPhone. */
export async function getWhatsAppConnectionByPhoneNumber(phoneNumber: string): Promise<WhatsAppConnection | null> {
  const target = normalizePhone(phoneNumber);
  if (!target) return null;

  const rows = await prisma.whatsAppConnection.findMany({
    where: { status: "connected", phoneNumber: { not: null } },
  });
  const match = rows.find((row) => row.phoneNumber && normalizePhone(row.phoneNumber) === target);
  return match ? toConnection(match) : null;
}

/** Fails soft (logs and returns null) rather than letting a database-side
 * problem take down the whole Communication page — same reasoning as the
 * other reads hardened in lib/db/appointments.ts and
 * lib/firestore/payments.ts. */
export async function getWhatsAppConnection(clinicId: string): Promise<WhatsAppConnection | null> {
  try {
    const row = await prisma.whatsAppConnection.findUnique({ where: { id: clinicId } });
    return row ? toConnection(row) : null;
  } catch (err) {
    console.error(`Failed to fetch WhatsApp connection for clinic ${clinicId}:`, err);
    return null;
  }
}

export interface UpsertWhatsAppConnectionInput {
  bhashUser: string;
  bhashPass: string;
  senderId: string;
  phoneNumber?: string;
}

export async function upsertWhatsAppConnection(clinicId: string, input: UpsertWhatsAppConnectionInput): Promise<void> {
  const now = BigInt(Date.now());
  await prisma.whatsAppConnection.upsert({
    where: { id: clinicId },
    create: {
      id: clinicId,
      status: "connected",
      bhashUser: input.bhashUser,
      bhashPass: input.bhashPass,
      senderId: input.senderId,
      phoneNumber: input.phoneNumber ?? null,
      connectedAt: now,
      updatedAt: now,
    },
    update: {
      status: "connected",
      bhashUser: input.bhashUser,
      bhashPass: input.bhashPass,
      senderId: input.senderId,
      phoneNumber: input.phoneNumber ?? null,
      updatedAt: now,
    },
  });
}

export async function deleteWhatsAppConnection(clinicId: string): Promise<void> {
  await prisma.whatsAppConnection.deleteMany({ where: { id: clinicId } });
}
