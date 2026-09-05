import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import type { WhatsAppProvider, WhatsAppConnectionCreds, NormalizedInboundMessage, SendResult } from "@/lib/whatsapp/types";

/**
 * The official Meta WhatsApp Cloud API (Graph API) — a direct connection to
 * a clinic's own WhatsApp Business Account, no reseller/BSP in between.
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Every clinic brings its own System User access token + phone number id
 * (Meta Business Settings), so this adapter is credential-per-clinic, same
 * shape as the BhashSMS integration it replaces — just against Meta
 * directly instead of a reseller.
 */

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface GraphErrorBody {
  error?: { message?: string; type?: string; code?: number };
}

async function callMessagesApi(connection: WhatsAppConnectionCreds, body: Record<string, unknown>): Promise<SendResult> {
  if (!connection.accessToken) {
    throw new Error("This clinic's WhatsApp connection is missing its Meta access token.");
  }

  const res = await fetch(`${GRAPH_BASE_URL}/${connection.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });

  const raw = await res.text();
  if (!res.ok) {
    let message = raw;
    try {
      const parsed = JSON.parse(raw) as GraphErrorBody;
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // raw wasn't JSON — fall back to the plain response text above.
    }
    throw new Error(`Meta WhatsApp API error (${res.status}): ${message}`);
  }

  let providerMessageId: string | undefined;
  try {
    providerMessageId = JSON.parse(raw)?.messages?.[0]?.id;
  } catch {
    // Unexpected but non-fatal — the send still succeeded (res.ok), we just
    // won't have Meta's own message id to store alongside it.
  }
  return { providerMessageId, raw };
}

export const metaCloudApiProvider: WhatsAppProvider = {
  name: "meta-cloud-api",

  async sendTemplateMessage(connection, toPhone, templateName, params, languageCode) {
    return callMessagesApi(connection, {
      to: toPhone,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(params.length > 0
          ? { components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] }
          : {}),
      },
    });
  },

  async sendFreeText(connection, toPhone, text) {
    return callMessagesApi(connection, { to: toPhone, type: "text", text: { body: text } });
  },

  parseInboundWebhook(rawBody) {
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new Error("Meta webhook body wasn't valid JSON.");
    }

    const events: NormalizedInboundMessage[] = [];
    const entries = (payload as { entry?: unknown[] })?.entry ?? [];
    for (const entry of entries) {
      const changes = (entry as { changes?: unknown[] })?.changes ?? [];
      for (const change of changes) {
        const value = (change as { value?: Record<string, unknown> })?.value;
        const messages = value?.messages as Record<string, unknown>[] | undefined;
        // Status callbacks (sent/delivered/read receipts, or a delivery
        // with no new message) show up here too, with no `messages` array —
        // nothing to record yet, not an error.
        if (!messages) continue;

        const phoneNumberId = (value?.metadata as Record<string, unknown> | undefined)?.phone_number_id as
          | string
          | undefined;
        if (!phoneNumberId) continue;

        for (const msg of messages) {
          // Only plain text is supported today — an image/audio/location/
          // interactive-reply message is skipped rather than guessed at,
          // same reasoning as elsewhere in this app: a wrong guess at a
          // shape silently corrupts data, a skip is visible and safe.
          if (msg.type !== "text") continue;
          const text = (msg.text as { body?: string } | undefined)?.body;
          if (!text) continue;

          events.push({
            fromPhone: msg.from as string,
            toPhone: phoneNumberId,
            body: text,
            providerMessageId: msg.id as string | undefined,
            timestampMs: Number(msg.timestamp) * 1000,
          });
        }
      }
    }
    return events;
  },

  verifyWebhookSignature(rawBody, headers, connection) {
    const signatureHeader = headers.get("x-hub-signature-256");
    if (!signatureHeader || !connection.appSecret) return false;

    const expected = `sha256=${createHmac("sha256", connection.appSecret).update(rawBody, "utf8").digest("hex")}`;
    const provided = Buffer.from(signatureHeader);
    const computed = Buffer.from(expected);
    // Lengths must match before timingSafeEqual — it throws on a length
    // mismatch rather than returning false.
    return provided.length === computed.length && timingSafeEqual(provided, computed);
  },
};
