"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/session";
import { createOrder, verifyCheckoutSignature } from "@/lib/razorpay";
import { createPendingPayment, confirmPayment } from "@/lib/db/payments";
import { clinicCacheTag } from "@/lib/db/clinics";
import { getAnnualPriceInr } from "@/lib/db/platformSettings";
import type { Session } from "@/types";

async function requireOwner(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  if (session.role !== "owner") throw new Error("Only the clinic owner can manage billing.");
  return session;
}

export interface CreateOrderResult {
  error?: string;
  order?: { orderId: string; amount: number; currency: string; keyId: string };
}

/** Starts a checkout: opens a Razorpay order for the flat annual price and
 * records a "created" payment doc so there's a record even if the customer
 * abandons checkout before paying. Called right before opening the Razorpay
 * Checkout widget client-side (components/settings/BillingSection.tsx). */
export async function createRenewalOrderAction(): Promise<CreateOrderResult> {
  try {
    const session = await requireOwner();

    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) return { error: "Billing isn't configured yet — contact support." };

    // Read fresh at checkout time, not cached at module load — a price
    // change from the admin panel should apply to the very next checkout,
    // not wait for a server restart.
    const annualPricePaise = (await getAnnualPriceInr()) * 100;

    const order = await createOrder({
      amount: annualPricePaise,
      currency: "INR",
      receipt: `${session.clinicId}-${Date.now()}`,
    });

    await createPendingPayment({
      clinicId: session.clinicId,
      razorpayOrderId: order.id,
      amount: annualPricePaise,
      currency: "INR",
    });

    return { order: { orderId: order.id, amount: annualPricePaise, currency: "INR", keyId } };
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
