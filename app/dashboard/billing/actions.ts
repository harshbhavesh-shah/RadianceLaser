"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/session";
import {
  cancelSubscription,
  createAnnualPlan,
  createOrder,
  createOrGetCustomer,
  createSubscription,
  fetchPayment,
  verifyCheckoutSignature,
  verifySubscriptionCheckoutSignature,
} from "@/lib/razorpay";
import { createPendingPayment, confirmPayment, recordSubscriptionCharge } from "@/lib/db/payments";
import { clinicCacheTag, getClinic, getClinicAutoRenewInfo, updateClinicAutoRenew } from "@/lib/db/clinics";
import { getTierPricing } from "@/lib/db/platformSettings";
import { PURCHASABLE_TIERS, ENTERPRISE_MIN_CENTERS, ENTERPRISE_MAX_CENTERS, getPurchaseTierPriceInr, type PurchasableTier } from "@/lib/pricing";
import type { Session } from "@/types";

async function requireOwner(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  if (session.role !== "owner") throw new Error("Only the clinic owner can manage billing.");
  return session;
}

/** Shared by both checkout paths below — never trust a tier/center count
 * from the client without checking it against this first, since both
 * ultimately decide how much money gets charged. */
function validateTierSelection(
  tier: PurchasableTier,
  enterpriseCenters: number | undefined
): string | null {
  if (!PURCHASABLE_TIERS.includes(tier)) return "That's not a valid plan.";
  if (tier === "enterprise") {
    if (
      enterpriseCenters === undefined ||
      !Number.isInteger(enterpriseCenters) ||
      enterpriseCenters < ENTERPRISE_MIN_CENTERS ||
      enterpriseCenters > ENTERPRISE_MAX_CENTERS
    ) {
      return `Enter a number of centers between ${ENTERPRISE_MIN_CENTERS} and ${ENTERPRISE_MAX_CENTERS}.`;
    }
  }
  return null;
}

export interface CreateOrderResult {
  error?: string;
  order?: { orderId: string; amount: number; currency: string; keyId: string };
}

/** Starts a checkout: opens a Razorpay order for the selected tier's real
 * price and records a "created" payment doc (carrying that tier) so there's
 * a record even if the customer abandons checkout before paying, and so
 * confirmPayment knows what to actually grant once they do. Called right
 * before opening the Razorpay Checkout widget client-side
 * (components/settings/BillingSection.tsx). */
export async function createRenewalOrderAction(
  tier: PurchasableTier,
  enterpriseCenters?: number
): Promise<CreateOrderResult> {
  try {
    const session = await requireOwner();

    const validationError = validateTierSelection(tier, enterpriseCenters);
    if (validationError) return { error: validationError };

    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) return { error: "Billing isn't configured yet. Contact support." };

    // Read fresh at checkout time, not cached at module load — a price
    // change from the admin panel should apply to the very next checkout,
    // not wait for a server restart.
    const pricing = await getTierPricing();
    const amountInr = getPurchaseTierPriceInr(tier, pricing, enterpriseCenters);
    const amountPaise = amountInr * 100;

    const order = await createOrder({
      amount: amountPaise,
      currency: "INR",
      receipt: `${session.clinicId}-${Date.now()}`,
    });

    await createPendingPayment({
      clinicId: session.clinicId,
      razorpayOrderId: order.id,
      amount: amountPaise,
      currency: "INR",
      planTier: tier,
      ...(tier === "enterprise" ? { enterpriseCenters } : {}),
    });

    return { order: { orderId: order.id, amount: amountPaise, currency: "INR", keyId } };
  } catch (err) {
    console.error("Failed to create Razorpay order:", err);
    return { error: "Couldn't start checkout. Please try again." };
  }
}

export interface VerifyPaymentResult {
  error?: string;
  success?: boolean;
}

/** Called from the Razorpay Checkout success callback with the payment
 * details it hands back. Verifies the signature server-side before trusting
 * any of it — the webhook (app/api/webhooks/razorpay/route.ts) is the
 * authoritative fallback if this never fires (e.g. the tab closes right
 * after paying), so losing this call isn't a way to permanently dodge
 * payment, just a slower confirmation. */
export async function verifyPaymentAction(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<VerifyPaymentResult> {
  try {
    const session = await requireOwner();

    if (!verifyCheckoutSignature(input)) {
      return { error: "Payment could not be verified. If money was deducted, contact support." };
    }

    await confirmPayment({
      razorpayOrderId: input.orderId,
      razorpayPaymentId: input.paymentId,
      expectedClinicId: session.clinicId,
    });

    revalidateTag(clinicCacheTag(session.clinicId));
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (err) {
    console.error("Failed to verify payment:", err);
    return {
      error: "Something went wrong confirming your payment. Contact support if you were charged.",
    };
  }
}

export interface CreateSubscriptionResult {
  error?: string;
  subscription?: { subscriptionId: string; keyId: string };
}

/**
 * Starts the opt-in auto-renew flow — creates (or reuses) a Razorpay
 * Customer, a fresh annual Plan at the selected tier's *current* price
 * (locked in for this subscription regardless of later admin price
 * changes — see Clinic.autoRenewPlanAmountInr/autoRenewPlanTier), and a
 * Subscription against it. If the clinic already has an active
 * subscription (switching tier while auto-renew is on), that one is
 * cancelled first — a Razorpay Plan's price is fixed at creation, so
 * changing tier always means a new Plan and Subscription, never editing
 * the existing one. The customer still has to authorize the first charge
 * through Razorpay Checkout client-side
 * (components/settings/BillingSection.tsx) before anything is actually
 * enabled — verifySubscriptionAction below is what flips autoRenewEnabled
 * on, once that's confirmed.
 */
export async function createAutoRenewSubscriptionAction(
  tier: PurchasableTier,
  enterpriseCenters?: number
): Promise<CreateSubscriptionResult> {
  try {
    const session = await requireOwner();

    const validationError = validateTierSelection(tier, enterpriseCenters);
    if (validationError) return { error: validationError };

    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) return { error: "Billing isn't configured yet. Contact support." };

    const clinic = await getClinic(session.clinicId);
    if (!clinic) return { error: "Clinic not found." };

    const pricing = await getTierPricing();
    const tierPriceInr = getPurchaseTierPriceInr(tier, pricing, enterpriseCenters);
    const info = await getClinicAutoRenewInfo(session.clinicId);

    if (info?.razorpaySubscriptionId && info.autoRenewEnabled) {
      try {
        await cancelSubscription(info.razorpaySubscriptionId);
      } catch (err) {
        // Best-effort — an already-cancelled/expired subscription errors
        // here too, and that's fine, the new one below still gets created.
        console.error("Failed to cancel previous subscription before switching tier:", err);
      }
    }

    const customer = info?.razorpayCustomerId
      ? { id: info.razorpayCustomerId }
      : await createOrGetCustomer({ name: clinic.name, email: session.email || "" });

    const plan = await createAnnualPlan(tierPriceInr * 100);
    const subscription = await createSubscription({
      planId: plan.id,
      customerId: customer.id,
      clinicId: session.clinicId,
    });

    await updateClinicAutoRenew(session.clinicId, {
      razorpayCustomerId: customer.id,
      razorpaySubscriptionId: subscription.id,
      razorpaySubscriptionStatus: subscription.status,
      autoRenewPlanAmountInr: tierPriceInr,
      autoRenewPlanTier: tier,
      ...(tier === "enterprise" ? { enterpriseCenters } : {}),
    });

    return { subscription: { subscriptionId: subscription.id, keyId } };
  } catch (err) {
    console.error("Failed to create Razorpay subscription:", err);
    return { error: "Couldn't set up auto-renew. Please try again." };
  }
}

export interface VerifySubscriptionResult {
  error?: string;
  success?: boolean;
}

/** Called from the Razorpay Checkout success callback once the customer
 * authorizes the subscription's first charge. Verifies the signature
 * server-side (a different HMAC formula than the one-time-order flow — see
 * verifySubscriptionCheckoutSignature) before trusting any of it, same
 * reasoning as verifyPaymentAction above. The subscription.charged webhook
 * is the authoritative fallback if the browser closes right after paying. */
export async function verifySubscriptionAction(input: {
  subscriptionId: string;
  paymentId: string;
  signature: string;
}): Promise<VerifySubscriptionResult> {
  try {
    const session = await requireOwner();

    if (!verifySubscriptionCheckoutSignature(input)) {
      return { error: "Payment could not be verified. If money was deducted, contact support." };
    }

    const info = await getClinicAutoRenewInfo(session.clinicId);
    if (info?.razorpaySubscriptionId !== input.subscriptionId) {
      return { error: "This subscription doesn't belong to your clinic." };
    }

    // The checkout callback only hands back a payment ID, not the order ID
    // Razorpay generated for it internally — fetch the payment to get that
    // (and the exact charged amount) for the Payment history row.
    const payment = await fetchPayment(input.paymentId);

    await recordSubscriptionCharge({
      clinicId: session.clinicId,
      razorpayOrderId: String(payment.order_id),
      razorpayPaymentId: input.paymentId,
      razorpaySubscriptionId: input.subscriptionId,
      amount: Number(payment.amount),
      currency: payment.currency,
      ...(info.autoRenewPlanTier ? { planTier: info.autoRenewPlanTier } : {}),
      ...(info.enterpriseCenters !== null ? { enterpriseCenters: info.enterpriseCenters } : {}),
    });

    await updateClinicAutoRenew(session.clinicId, {
      autoRenewEnabled: true,
      razorpaySubscriptionStatus: "active",
      dunningEmailSentForStatus: null,
    });

    revalidateTag(clinicCacheTag(session.clinicId));
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (err) {
    console.error("Failed to verify subscription:", err);
    return {
      error: "Something went wrong confirming auto-renew. Contact support if you were charged.",
    };
  }
}

export interface CancelAutoRenewResult {
  error?: string;
  success?: boolean;
}

/** Turns auto-renew off — cancels future auto-charges at Razorpay
 * immediately. The clinic's already-paid-for access (subscriptionRenewsAt)
 * is completely untouched; they simply fall back to the manual renewal
 * flow from here, same as if auto-renew had never been turned on. */
export async function cancelAutoRenewAction(): Promise<CancelAutoRenewResult> {
  try {
    const session = await requireOwner();

    const info = await getClinicAutoRenewInfo(session.clinicId);
    if (!info?.razorpaySubscriptionId) {
      return { error: "Auto-renew isn't currently on." };
    }

    await cancelSubscription(info.razorpaySubscriptionId);
    await updateClinicAutoRenew(session.clinicId, {
      autoRenewEnabled: false,
      razorpaySubscriptionStatus: "cancelled",
    });

    revalidateTag(clinicCacheTag(session.clinicId));
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (err) {
    console.error("Failed to cancel auto-renew:", err);
    return { error: "Couldn't turn off auto-renew. Please try again." };
  }
}
