import "server-only";
import type { WhatsAppConnection } from "@/types";

// The contract every WhatsApp BSP adapter implements — the webhook route,
// the reply action, and the reminder/feedback cron all talk to this
// interface, never to a specific provider's request/response shape
// directly. Swapping providers later (e.g. once a wholesale reseller deal
// is in place) means writing one new file under lib/whatsapp/providers/
// and pointing lib/whatsapp/activeProvider.ts at it — nothing that calls
// through this interface needs to change.

/** Only the fields an adapter actually needs to authenticate a send —
 * never the full WhatsAppConnection row (callers already have that; this
 * just documents the minimum shape). */
export type WhatsAppConnectionCreds = Pick<WhatsAppConnection, "bhashUser" | "bhashPass" | "senderId">;

export interface SendResult {
  providerMessageId?: string;
  raw: string;
}

/** One inbound message, already normalized out of whatever shape the
 * provider's webhook payload actually uses. `toPhone` is what routes this
 * to the right clinic — see lib/db/whatsappConversations.ts
 * recordInboundMessage, which looks up the clinic by
 * WhatsAppConnection.phoneNumber. */
export interface NormalizedInboundMessage {
  fromPhone: string;
  toPhone: string;
  body: string;
  providerMessageId?: string;
  timestampMs: number;
}

export interface WhatsAppProvider {
  name: string;

  /** Sends an approved template message — the only kind of send every
   * provider (and WhatsApp's own policy) allows outside a 24-hour
   * customer-service window. */
  sendTemplateMessage(
    connection: WhatsAppConnectionCreds,
    toPhone: string,
    templateName: string,
    params: string[]
  ): Promise<SendResult>;

  /** Sends free-form text — only valid inside the 24-hour window opened by
   * the patient's own last inbound message. Not every provider's API
   * supports this the same way (or at all on a lower-tier plan), so an
   * adapter that can't do this yet should reject with a clear message
   * rather than silently no-op. */
  sendFreeText(connection: WhatsAppConnectionCreds, toPhone: string, text: string): Promise<SendResult>;

  /** Verifies the webhook request actually came from this provider (HMAC
   * signature, shared secret, whatever the provider uses) before any
   * payload parsing happens. Return false to reject the request outright. */
  verifyWebhookRequest(rawBody: string, headers: Headers): boolean;

  /** Turns the provider's own webhook payload shape into our normalized
   * form. A provider's webhook can batch multiple events in one delivery,
   * hence the array return. */
  parseInboundWebhook(rawBody: string): NormalizedInboundMessage[];
}
