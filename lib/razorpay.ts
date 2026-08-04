import "server-only";
import crypto from "crypto";
import Razorpay from "razorpay";

// Lazily initialized, same reasoning as lib/firebase/admin.ts's
// getAdminApp(): avoids requiring real credentials at `next build` time,
// only when a request actually needs them.
let _client: Razorpay | undefined;

function getClient(): Razorpay {
  if (_client) return _client;

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error(
      "Missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET in .env.local. See .env.local.example."
    );
  }

  _client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return _client;
}

export async function createOrder(input: {
  amount: number; // smallest currency unit (paise for INR)
  currency: string;
  receipt: string;
}) {
  return getClient().orders.create(input);
}

/** Constant-time compare that doesn't throw on mismatched lengths (unlike a
 * bare crypto.timingSafeEqual, which requires equal-length buffers) — an
 * attacker sending a garbage-length signature should get a clean "invalid",
 * not a 500. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies the signature Razorpay Checkout hands back to the client on a
 * successful payment (HMAC-SHA256 of "{order_id}|{payment_id}" using the API
 * key secret). This is what actually proves a payment happened — never
 * grant access just because the client-side success callback fired, since
 * that callback is client-controlled and could be spoofed.
 */
export function verifyCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) throw new Error("Missing RAZORPAY_KEY_SECRET in .env.local.");

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");

  return safeEqual(expected, input.signature);
}

/**
 * Verifies the X-Razorpay-Signature header on an incoming webhook request —
 * HMAC-SHA256 of the raw request body using the separate webhook secret set
 * when the webhook is configured in the Razorpay dashboard (NOT the API key
 * secret — a different value). Must be run against the raw, unparsed body;
 * re-serializing parsed JSON can produce different bytes and fail
 * verification even for a genuine request.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("Missing RAZORPAY_WEBHOOK_SECRET in .env.local.");

  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return safeEqual(expected, signature);
}
