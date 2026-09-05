import { NextRequest, NextResponse } from "next/server";
import { activeProvider } from "@/lib/whatsapp/activeProvider";
import { getWhatsAppConnectionByPhoneNumberId } from "@/lib/db/whatsapp";
import { recordInboundMessage } from "@/lib/db/whatsappConversations";

// One shared endpoint for every clinic's inbound WhatsApp traffic — each
// event identifies which clinic it belongs to via its own phoneNumberId
// (see NormalizedInboundMessage.toPhone), so there's no clinic id in this
// URL. Register this same URL (https://<host>/api/webhooks/whatsapp) as
// the webhook callback for every clinic's own Meta App.

/**
 * Meta verifies a webhook URL with a GET request carrying
 * `hub.mode=subscribe`, `hub.verify_token=<your secret>`, and
 * `hub.challenge=<random string>` — echo the challenge back once the token
 * matches to complete setup. WHATSAPP_WEBHOOK_VERIFY_TOKEN is a value this
 * app chooses (not something Meta gives you); every clinic enters the same
 * value when subscribing their own Meta App's webhook, since this token
 * only proves the callback URL is really ours — the real per-request
 * authentication is the POST handler's per-clinic signature check below.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && expectedToken && token === expectedToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();

  let events;
  try {
    events = activeProvider.parseInboundWebhook(rawBody);
  } catch (err) {
    // Logged, not thrown further — a webhook that 500s gets retried
    // (sometimes aggressively) by Meta, which won't fix a parsing problem
    // and just adds noise. Acknowledge receipt either way; fix the
    // adapter, don't leave Meta hammering a broken endpoint.
    console.error("Failed to parse inbound WhatsApp webhook:", err);
    return NextResponse.json({ received: true, parsed: false });
  }

  let recorded = 0;
  for (const event of events) {
    try {
      // Each event names its own receiving number (Meta's phoneNumberId),
      // which is also which clinic's connection secret verifies this
      // delivery's signature — verification can't happen any earlier than
      // this, since it depends on knowing which clinic the payload is for.
      const connection = await getWhatsAppConnectionByPhoneNumberId(event.toPhone);
      if (!connection) {
        console.error(`Inbound WhatsApp message to unrecognized phoneNumberId ${event.toPhone} — no clinic owns it.`);
        continue;
      }
      if (!activeProvider.verifyWebhookSignature(rawBody, request.headers, connection)) {
        console.error(`Inbound WhatsApp webhook failed signature verification for clinic ${connection.clinicId}.`);
        continue;
      }

      await recordInboundMessage(event);
      recorded++;
    } catch (err) {
      console.error("Failed to record inbound WhatsApp message:", err);
    }
  }

  return NextResponse.json({ received: true, parsed: events.length, recorded });
}
