import "server-only";
import { prisma } from "@/lib/db/client";
import type { WhatsAppConnection as PrismaWhatsAppConnectionRow } from "@prisma/client";
import type { WhatsAppConnection, WhatsAppConnectionStatus } from "@/types";

// Postgres migration, chunk 14 (post-launch cleanup) — WhatsAppConnection,
// since replaced with the official Meta WhatsApp Cloud API in place of the
// original BhashSMS-credential shape. Function names/signatures still
// intentionally match lib/firestore/whatsapp.ts as closely as possible.

function toConnection(row: PrismaWhatsAppConnectionRow): WhatsAppConnection {
  return {
    id: row.id,
    clinicId: row.id,
    status: row.status as WhatsAppConnectionStatus,
    phoneNumberId: row.phoneNumberId,
    updatedAt: Number(row.updatedAt),
    ...(row.accessToken ? { accessToken: row.accessToken } : {}),
    ...(row.appSecret ? { appSecret: row.appSecret } : {}),
    ...(row.wabaId ? { wabaId: row.wabaId } : {}),
    ...(row.phoneNumber ? { phoneNumber: row.phoneNumber } : {}),
    ...(row.lastError ? { lastError: row.lastError } : {}),
    ...(row.connectedAt !== null ? { connectedAt: Number(row.connectedAt) } : {}),
  };
}

/** Finds which clinic a WhatsApp number belongs to — how an inbound
 * webhook event (which only knows the receiving number's Meta
 * phoneNumberId, not a clinicId) gets routed. A full scan over connected
 * accounts rather than an indexed lookup: there's one row per clinic here,
 * not per patient, so this table stays small enough that it doesn't need
 * the same treatment as findPatientByPhone. Unlike the old phone-number
 * matching this replaced, phoneNumberId is an exact opaque id from Meta —
 * no normalization needed. */
export async function getWhatsAppConnectionByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppConnection | null> {
  if (!phoneNumberId) return null;
  const row = await prisma.whatsAppConnection.findFirst({
    where: { status: "connected", phoneNumberId },
  });
  return row ? toConnection(row) : null;
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
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
  wabaId?: string;
  phoneNumber?: string;
}

export async function upsertWhatsAppConnection(clinicId: string, input: UpsertWhatsAppConnectionInput): Promise<void> {
  const now = BigInt(Date.now());
  await prisma.whatsAppConnection.upsert({
    where: { id: clinicId },
    create: {
      id: clinicId,
      status: "connected",
      phoneNumberId: input.phoneNumberId,
      accessToken: input.accessToken,
      appSecret: input.appSecret,
      wabaId: input.wabaId ?? null,
      phoneNumber: input.phoneNumber ?? null,
      connectedAt: now,
      updatedAt: now,
    },
    update: {
      status: "connected",
      phoneNumberId: input.phoneNumberId,
      accessToken: input.accessToken,
      appSecret: input.appSecret,
      wabaId: input.wabaId ?? null,
      phoneNumber: input.phoneNumber ?? null,
      updatedAt: now,
    },
  });
}

export async function deleteWhatsAppConnection(clinicId: string): Promise<void> {
  await prisma.whatsAppConnection.deleteMany({ where: { id: clinicId } });
}
