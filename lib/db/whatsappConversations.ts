import "server-only";
import { prisma } from "@/lib/db/client";
import { getWhatsAppConnectionByPhoneNumberId } from "@/lib/db/whatsapp";
import { findPatientByPhone } from "@/lib/db/patients";
import { normalizePhone } from "@/lib/phone";
import type {
  WhatsAppConversation as PrismaConversationRow,
  WhatsAppMessage as PrismaMessageRow,
} from "@prisma/client";
import type { WhatsAppConversation, WhatsAppMessage, MessageDirection, MessageDeliveryStatus } from "@/types";
import type { NormalizedInboundMessage } from "@/lib/whatsapp/types";

// Backs the Inbox page (two-way WhatsApp) — see lib/whatsapp/types.ts for
// the provider-agnostic contract that feeds recordInboundMessage below.
// Nothing in this file assumes a specific BSP's payload shape; that
// translation happens once, in the active provider adapter, before any of
// these functions are called.

const PREVIEW_MAX_LENGTH = 120;

function toConversation(row: PrismaConversationRow): WhatsAppConversation {
  return {
    id: row.id,
    clinicId: row.clinicId,
    phoneNumber: row.phoneNumber,
    lastMessagePreview: row.lastMessagePreview,
    lastMessageAt: Number(row.lastMessageAt),
    unreadCount: row.unreadCount,
    updatedAt: Number(row.updatedAt),
    ...(row.patientId ? { patientId: row.patientId } : {}),
    ...(row.patientName ? { patientName: row.patientName } : {}),
  };
}

function toMessage(row: PrismaMessageRow): WhatsAppMessage {
  return {
    id: row.id,
    clinicId: row.clinicId,
    conversationId: row.conversationId,
    direction: row.direction as MessageDirection,
    body: row.body,
    status: row.status as MessageDeliveryStatus,
    createdAt: Number(row.createdAt),
    ...(row.templateId ? { templateId: row.templateId } : {}),
    ...(row.providerMessageId ? { providerMessageId: row.providerMessageId } : {}),
  };
}

function previewOf(body: string): string {
  return body.length > PREVIEW_MAX_LENGTH ? `${body.slice(0, PREVIEW_MAX_LENGTH)}…` : body;
}

/** Every conversation for a clinic, most recently active first — the
 * Inbox page's conversation list. */
export async function getClinicConversations(clinicId: string): Promise<WhatsAppConversation[]> {
  const rows = await prisma.whatsAppConversation.findMany({
    where: { clinicId },
    orderBy: { lastMessageAt: "desc" },
  });
  return rows.map(toConversation);
}

/** One conversation's full message history, oldest first (reading order). */
export async function getConversationMessages(clinicId: string, conversationId: string): Promise<WhatsAppMessage[]> {
  const conversation = await prisma.whatsAppConversation.findUnique({ where: { id: conversationId } });
  if (!conversation || conversation.clinicId !== clinicId) return [];

  const rows = await prisma.whatsAppMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toMessage);
}

export async function markConversationRead(clinicId: string, conversationId: string): Promise<void> {
  await prisma.whatsAppConversation.updateMany({
    where: { id: conversationId, clinicId },
    data: { unreadCount: 0 },
  });
}

/**
 * The landing point for every inbound message, regardless of which
 * provider's webhook it came from — the webhook route calls this once per
 * normalized event, after that event's signature has already been
 * verified. Routes to a clinic by matching `toPhone` (Meta's phoneNumberId)
 * against WhatsAppConnection.phoneNumberId, finds or creates that
 * patient's conversation thread, and best-effort links it to a Patient
 * record by phone (a match isn't required — an unrecognized number still
 * gets a conversation, same as an unlinked public appointment booking).
 *
 * Returns null (and does nothing else) if no connected clinic owns
 * `toPhone` — nothing to route an orphaned event to.
 */
export async function recordInboundMessage(event: NormalizedInboundMessage): Promise<WhatsAppMessage | null> {
  const connection = await getWhatsAppConnectionByPhoneNumberId(event.toPhone);
  if (!connection) {
    console.error(`Inbound WhatsApp message to unrecognized phoneNumberId ${event.toPhone} — no clinic owns it.`);
    return null;
  }

  const clinicId = connection.clinicId;
  const fromNormalized = normalizePhone(event.fromPhone);
  const patient = await findPatientByPhone(clinicId, event.fromPhone);
  const now = BigInt(event.timestampMs || Date.now());
  const preview = previewOf(event.body);

  const conversation = await prisma.whatsAppConversation.upsert({
    where: { clinicId_phoneNumber: { clinicId, phoneNumber: fromNormalized } },
    create: {
      clinicId,
      phoneNumber: fromNormalized,
      patientId: patient?.id ?? null,
      patientName: patient?.name ?? null,
      lastMessagePreview: preview,
      lastMessageAt: now,
      unreadCount: 1,
      updatedAt: now,
    },
    update: {
      // A patient linked after the thread started still gets picked up on
      // their next message, rather than staying "unlinked" forever.
      ...(patient ? { patientId: patient.id, patientName: patient.name } : {}),
      lastMessagePreview: preview,
      lastMessageAt: now,
      unreadCount: { increment: 1 },
      updatedAt: now,
    },
  });

  const message = await prisma.whatsAppMessage.create({
    data: {
      clinicId,
      conversationId: conversation.id,
      direction: "inbound",
      body: event.body,
      status: "delivered",
      providerMessageId: event.providerMessageId ?? null,
      createdAt: now,
    },
  });
  return toMessage(message);
}

/** Records a reply sent from the Inbox (or any other outbound send tied to
 * an existing conversation) — the send itself happens in the caller via
 * the active provider; this just logs it and bumps the thread. */
export async function recordOutboundMessage(
  clinicId: string,
  conversationId: string,
  body: string,
  status: MessageDeliveryStatus,
  options?: { templateId?: string; providerMessageId?: string }
): Promise<WhatsAppMessage> {
  const now = BigInt(Date.now());

  const message = await prisma.whatsAppMessage.create({
    data: {
      clinicId,
      conversationId,
      direction: "outbound",
      body,
      status,
      templateId: options?.templateId ?? null,
      providerMessageId: options?.providerMessageId ?? null,
      createdAt: now,
    },
  });

  await prisma.whatsAppConversation.updateMany({
    where: { id: conversationId, clinicId },
    data: { lastMessagePreview: previewOf(body), lastMessageAt: now, updatedAt: now },
  });

  return toMessage(message);
}
