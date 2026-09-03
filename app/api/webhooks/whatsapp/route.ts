import { NextRequest, NextResponse } from "next/server";
import { activeProvider } from "@/lib/whatsapp/activeProvider";
import { recordInboundMessage } from "@/lib/db/whatsappConversations";

// One shared endpoint for every clinic's inbound WhatsApp traffic — the
// provider identifies which clinic a message belongs to (see
// NormalizedInboundMessage.toPhone), so there's no clinic id in this URL.
// All the provider-specific work (auth, payload shape) is delegated to
// lib/whatsapp/activeProvider.ts; this route only orchestrates.

/**
 * Many BSPs (following Meta's own Cloud API convention) verify a webhook
 * URL with a GET request carrying `hub.mode=subscribe`,
 * `hub.verify_token=<your secret>`, and `hub.challenge=<random string>` —
 * echo the challenge back once the token matches to complete setup.
 * WHATSAPP_WEBHOOK_VERIFY_TOKEN is a value you choose and enter into the
 * provider's dashboard, not something they give you. If the real provider
 * doesn't use this convention, this handler is simply unused — it's not
 * required for the POST path below to work.
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

  if (!activeProvider.verifyWebhookRequest(rawBody, request.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let events;
  try {
    events = activeProvider.parseInboundWebhook(rawBody);
  } catch (err) {
    // Logged, not thrown further — a webhook that 500s gets retried
    // (sometimes aggressively) by the sender, which won't fix a parsing
    // problem and just adds noise. Acknowledge receipt either way; fix the
    // adapter, don't leave the provider hammering a broken endpoint.
    console.error("Failed to parse inbound WhatsApp webhook:", err);
    return NextResponse.json({ received: true, parsed: false });
  }

  for (const event of events) {
    try {
      await recordInboundMessage(event);
    } catch (err) {
      console.error("Failed to record inbound WhatsApp message:", err);
    }
  }

  return NextResponse.json({ received: true, parsed: events.length });
}
