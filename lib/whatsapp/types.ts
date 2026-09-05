import "server-only";
import type { WhatsAppConnection } from "@/types";

// The contract every WhatsApp BSP adapter implements — the webhook route,
// the reply action, and the reminder/feedback cron all talk to this
// interface, never to a specific provider's request/response shape
// directly. Only one adapter exists today (lib/whatsapp/providers/
// metaCloudApi.ts, the official Meta WhatsApp Cloud API), but nothing
// calling through this interface needs to change if that ever swaps.

/** Only the fields an adapter actually needs to authenticate a call —
 * never the full WhatsAppConnection row (callers already have that; this
 * just documents the minimum shape). */
export type WhatsAppConnectionCreds = Pick<WhatsAppConnection, "phoneNumberId" | "accessToken" | "appSecret">;

export interface SendResult {
  providerMessageId?: string;
  raw: string;
}

/** One inbound message, already normalized out of whatever shape the
 * provider's webhook payload actually uses. `toPhone` is the provider's own
 * id for the receiving number (Meta's phoneNumberId, not a phone number
 * string) — what routes this to the right clinic, see
 * lib/db/whatsappConversations.ts recordInboundMessage, which looks it up
 * against WhatsAppConnection.phoneNumberId. */
export interface NormalizedInboundMessage {
  fromPhone: string;
  toPhone: string;
  body: string;
  providerMessageId?: string;
  timestampMs: number;
}

export interface WhatsAppProvider {
  name: string;

  /** Sends an approved template message — the only kind of send WhatsApp's
   * own policy allows outside a 24-hour customer-service window.
   * `languageCode` must match exactly what the template was approved
   * under (e.g. "en_US") — see types/index.ts MessageTemplate.language. */
  sendTemplateMessage(
    connection: WhatsAppConnectionCreds,
    toPhone: string,
    templateName: string,
    params: string[],
    languageCode: string
  ): Promise<SendResult>;

  /** Sends free-form text — only valid inside the 24-hour window opened by
   * the patient's own last inbound message. */
  sendFreeText(connection: WhatsAppConnectionCreds, toPhone: string, text: string): Promise<SendResult>;

  /** Turns the provider's own webhook payload shape into our normalized
   * form, without verifying authenticity yet — that needs to know which
   * clinic's connection (and secret) the payload belongs to, which this
   * step is what discovers (via each event's `toPhone`). A provider's
   * webhook can batch multiple events in one delivery, hence the array
   * return. Status-update-only deliveries (sent/delivered/read receipts,
   * no new message) should just return an empty array, not throw. */
  parseInboundWebhook(rawBody: string): NormalizedInboundMessage[];

  /** Verifies one delivery actually came from the provider, using the
   * matched clinic's own connection secret — called once per event, after
   * parseInboundWebhook has identified which clinic it's for. Return false
   * to have that event rejected outright. */
  verifyWebhookSignature(rawBody: string, headers: Headers, connection: WhatsAppConnectionCreds): boolean;
}
