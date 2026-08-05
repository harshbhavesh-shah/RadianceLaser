import "server-only";
import type { MessageTemplate, TemplateButton, WhatsAppConnection } from "@/types";

/**
 * Wraps Gupshup's Partner API (managing per-clinic WhatsApp sub-accounts),
 * Template API (submitting message templates for Meta approval), and
 * Messages API (actually sending).
 *
 * IMPORTANT — unverified against a live account: this project has no real
 * Gupshup partner account or Meta Business verification yet (that requires
 * the clinic owner's/platform owner's actual business identity, not
 * something buildable from here). The endpoint paths and payload shapes
 * below are written against Gupshup's public API docs as of this writing,
 * but have never been exercised against a live sandbox. Before going live,
 * whoever holds the real Gupshup partner credentials needs to run one
 * connection + one template submission + one send end-to-end and fix up
 * whatever's drifted from the docs — the rest of the app (data model,
 * Settings UI, Firestore rules) does not need to change for that, only the
 * HTTP calls in this one file.
 */

const PARTNER_BASE_URL = "https://partner.gupshup.io/partner";
const MESSAGE_BASE_URL = "https://api.gupshup.io/wa/api/v1";

function requirePartnerCredentials(): { id: string; secret: string } {
  const id = process.env.GUPSHUP_PARTNER_CLIENT_ID;
  const secret = process.env.GUPSHUP_PARTNER_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error(
      "Missing GUPSHUP_PARTNER_CLIENT_ID / GUPSHUP_PARTNER_CLIENT_SECRET in .env.local — required for the managed " +
        "(embedded signup) connection flow. See .env.local.example."
    );
  }
  return { id, secret };
}

let _partnerToken: { token: string; expiresAt: number } | undefined;

/** Partner-level auth token, cached until near expiry. Gupshup's partner
 * tokens are short-lived (typically ~24h) — refreshed lazily rather than on
 * a timer, since this is only ever called right before a partner API call. */
async function getPartnerToken(): Promise<string> {
  if (_partnerToken && _partnerToken.expiresAt > Date.now() + 60_000) {
    return _partnerToken.token;
  }

  const { id, secret } = requirePartnerCredentials();
  const res = await fetch(`${PARTNER_BASE_URL}/account/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email: id, password: secret }),
  });
  if (!res.ok) {
    throw new Error(`Gupshup partner login failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  // Field name per Gupshup's docs at time of writing — verify against a
  // real response before relying on this.
  const token = data.token as string;
  _partnerToken = { token, expiresAt: Date.now() + 20 * 60 * 60 * 1000 };
  return token;
}

/**
 * Kicks off the managed connection flow for a clinic — returns the URL to
 * open in Meta's embedded signup popup, scoped to our Gupshup partner
 * account. The clinic picks/verifies their own WhatsApp number inside that
 * popup; Gupshup calls back with the resulting appId, which
 * completeManagedConnection() below then persists.
 */
export async function startManagedConnection(clinicId: string): Promise<{ signupUrl: string }> {
  await getPartnerToken();
  // Embedded signup is configured per Gupshup partner dashboard (a
  // Meta-issued config ID tied to our partner app), not something this
  // function can construct from clinicId alone — the real implementation
  // needs GUPSHUP_EMBEDDED_SIGNUP_CONFIG_ID from that dashboard.
  const configId = process.env.GUPSHUP_EMBEDDED_SIGNUP_CONFIG_ID;
  if (!configId) {
    throw new Error("Missing GUPSHUP_EMBEDDED_SIGNUP_CONFIG_ID in .env.local — see Gupshup partner dashboard.");
  }
  return {
    signupUrl: `https://www.facebook.com/dialog/oauth?config_id=${configId}&state=${clinicId}`,
  };
}

/** Validates a clinic-supplied BYO API key/app id pair by fetching that
 * app's details from Gupshup — fails loudly rather than silently accepting
 * bad credentials, so Settings can show a real error instead of a
 * connection that looks fine until the first send fails. */
export async function validateByoCredentials(appId: string, apiKey: string): Promise<{ displayPhoneNumber: string }> {
  const res = await fetch(`${PARTNER_BASE_URL}/app/${appId}`, {
    headers: { apikey: apiKey },
  });
  if (!res.ok) {
    throw new Error("Couldn't verify this Gupshup app — check the App ID and API key.");
  }
  const data = await res.json();
  return { displayPhoneNumber: data.phoneNumber ?? data.phone ?? "" };
}

function validateButtons(buttons: TemplateButton[]): void {
  if (buttons.length > 3) throw new Error("WhatsApp templates allow at most 3 buttons.");
  for (const b of buttons) {
    if (b.label.length > 20) throw new Error(`Button label "${b.label}" exceeds WhatsApp's 20-character limit.`);
    if ((b.type === "call" || b.type === "url") && !b.value) {
      throw new Error(`A "${b.type}" button needs a value (phone number or URL).`);
    }
  }
}

/** Submits a template to Meta (via Gupshup) for approval. Approval is
 * asynchronous and out of our control — typically under a day, sometimes
 * longer — so this only ever returns "pending"; the actual approved/
 * rejected outcome arrives later via webhook (see app/api/webhooks/gupshup,
 * planned next) and updates the template doc from there. */
export async function submitTemplate(
  connection: WhatsAppConnection,
  template: Pick<MessageTemplate, "name" | "category" | "language" | "body" | "buttons">
): Promise<{ gupshupTemplateId: string }> {
  validateButtons(template.buttons);
  if (!connection.gupshupAppId) throw new Error("This clinic's WhatsApp connection has no app id yet.");

  const apiKey = connection.mode === "byo" ? connection.byoApiKey : await getPartnerToken();
  if (!apiKey) throw new Error("This clinic's WhatsApp connection is missing credentials.");

  const res = await fetch(`${PARTNER_BASE_URL}/app/${connection.gupshupAppId}/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({
      elementName: template.name,
      category: template.category === "custom" ? "UTILITY" : "UTILITY",
      languageCode: template.language,
      templateType: "TEXT",
      content: template.body,
      buttons: template.buttons.map((b) => ({ type: b.type.toUpperCase(), text: b.label, value: b.value })),
    }),
  });
  if (!res.ok) {
    throw new Error(`Gupshup template submission failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { gupshupTemplateId: data.id ?? data.templateId };
}

/** Sends an approved template message to a phone number, filling in the
 * template's {{n}} placeholders in order. */
export async function sendTemplateMessage(
  connection: WhatsAppConnection,
  toPhoneE164: string,
  gupshupTemplateId: string,
  variables: string[]
): Promise<{ gupshupMessageId: string }> {
  const apiKey = connection.mode === "byo" ? connection.byoApiKey : await getPartnerToken();
  if (!apiKey) throw new Error("This clinic's WhatsApp connection is missing credentials.");

  const res = await fetch(`${MESSAGE_BASE_URL}/template/msg`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", apikey: apiKey },
    body: new URLSearchParams({
      source: connection.displayPhoneNumber ?? "",
      destination: toPhoneE164,
      template: JSON.stringify({ id: gupshupTemplateId, params: variables }),
    }),
  });
  if (!res.ok) {
    throw new Error(`Gupshup send failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return { gupshupMessageId: data.messageId ?? data.id };
}
