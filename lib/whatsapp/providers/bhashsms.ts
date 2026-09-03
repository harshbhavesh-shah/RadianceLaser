import "server-only";
import { sendTemplateMessage as bhashSendTemplate } from "@/lib/bhashsms/client";
import type { WhatsAppProvider, NormalizedInboundMessage } from "@/lib/whatsapp/types";

/**
 * BhashSMS adapter — the currently-connected provider. Two methods below
 * are stubs, not because they're hard, but because they depend on facts
 * this codebase doesn't have yet:
 *
 *   - sendFreeText: BhashSMS's confirmed API surface (see
 *     lib/bhashsms/client.ts) is `sendmsg.php` with `text=<template name>`
 *     — every real call seen so far sends an approved template, never
 *     arbitrary text. Whether BhashSMS has a separate free-text/session-
 *     message endpoint for replying inside the 24-hour window is unknown.
 *     Confirm with BhashSMS support before implementing this for real.
 *   - parseInboundWebhook / verifyWebhookRequest: BhashSMS has no public
 *     webhook documentation. The actual payload shape (field names, how
 *     the receiving number is identified, whether there's an HMAC
 *     signature or a shared-secret query param) has to come from their
 *     dashboard or support before this can parse anything real. Get a
 *     sample payload first, then fill these in — don't guess the shape,
 *     a wrong guess silently drops real patient replies instead of
 *     visibly failing.
 */
export const bhashSmsProvider: WhatsAppProvider = {
  name: "bhashsms",

  sendTemplateMessage: bhashSendTemplate,

  async sendFreeText(): Promise<never> {
    throw new Error(
      "BhashSMS free-text replies aren't confirmed yet — check with BhashSMS support whether their API supports sending outside an approved template, then implement this."
    );
  },

  verifyWebhookRequest(): boolean {
    // Fails closed until BhashSMS's real auth mechanism (signature header,
    // shared secret, IP allowlist — whatever it turns out to be) is known.
    // A webhook that accepts unverified requests is worse than one that
    // accepts none.
    return false;
  },

  parseInboundWebhook(): NormalizedInboundMessage[] {
    throw new Error(
      "BhashSMS's inbound webhook payload shape is unconfirmed — get a real sample payload from their dashboard or support and fill this in before enabling inbound messages."
    );
  },
};
