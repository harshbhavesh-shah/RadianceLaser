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

/**
 * Creates (or reuses) a Razorpay Customer for a clinic — Subscriptions
 * require one, unlike one-time Orders. `fail_existing: "0"` makes this
 * idempotent: calling it again with the same email/contact returns the
 * existing customer instead of erroring, so re-enabling auto-renew after
 * cancelling doesn't create duplicate customer records.
 */
export async function createOrGetCustomer(input: { name: string; email: string }) {
  return getClient().customers.create({
    name: input.name,
    email: input.email,
    fail_existing: 0,
  });
}

/**
 * A fresh annual Plan for whatever the clinic's price is *right now*. Not
 * cached/reused across clinics on purpose — locking each subscription to
 * the plan (and therefore price) it was created under means a later admin
 * price change (lib/db/platformSettings.ts) never silently reprices an
 * existing auto-renewing clinic; Clinic.autoRenewPlanAmountInr records what
 * that locked-in price was for display.
 */
export async function createAnnualPlan(amountInPaise: number) {
  return getClient().plans.create({
    period: "yearly",
    interval: 1,
    item: {
      name: "RadianceLaser annual subscription",
      amount: amountInPaise,
      currency: "INR",
    },
  });
}

/**
 * total_count: 100 means "up to 100 yearly charges" — Razorpay Subscriptions
 * require a fixed count, there's no "forever" option, so this is the
 * practical stand-in for indefinite auto-renewal (100 years). Cancelling
 * early (cancelAutoRenewAction) is the actual way a clinic stops it, same
 * as any subscription product.
 */
export async function createSubscription(input: { planId: string; customerId: string; clinicId: string }) {
  return getClient().subscriptions.create({
    plan_id: input.planId,
    customer_notify: 1,
    total_count: 100,
    notes: { clinicId: input.clinicId },
  });
}

/** Cancels future auto-charges immediately — the clinic's already-paid-for
 * access (subscriptionRenewsAt) is untouched, same as if auto-renew had
 * never been on; they just fall back to the manual renewal flow. */
export async function cancelSubscription(subscriptionId: string) {
  return getClient().subscriptions.cancel(subscriptionId);
}

/** A single Razorpay payment's details — used to backfill the order_id for
 * a Payment history row when a subscription's first charge is confirmed via
 * the client-side checkout callback, which only hands back the payment ID,
 * not the order ID Razorpay generated for it internally. */
export async function fetchPayment(paymentId: string) {
  return getClient().payments.fetch(paymentId);
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
 * Same purpose as verifyCheckoutSignature, for the Subscriptions checkout
 * flow instead of one-time Orders — note the HMAC input order is reversed
 * ("{payment_id}|{subscription_id}", not "{order_id}|{payment_id}"), which
 * is Razorpay's own documented format for subscriptions, not a typo.
 */
export function verifySubscriptionCheckoutSignature(input: {
  subscriptionId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) throw new Error("Missing RAZORPAY_KEY_SECRET in .env.local.");

  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${input.paymentId}|${input.subscriptionId}`)
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
