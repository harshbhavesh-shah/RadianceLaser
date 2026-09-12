import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { confirmPayment, recordSubscriptionCharge } from "@/lib/db/payments";
import { clinicCacheTag, getClinicIdByRazorpaySubscriptionId, updateClinicAutoRenew } from "@/lib/db/clinics";
import { getClinicOwnerEmails } from "@/lib/db/staff";
import { sendEmail } from "@/lib/email/resend";
import { autoRenewCancelledEmailHtml, autoRenewHaltedEmailHtml, paymentRetryingEmailHtml } from "@/lib/billingEmails";
import { prisma } from "@/lib/db/client";

// Authoritative confirmation path for payments, independent of whether the
// customer's browser is still around to run the client-side success
// callback (app/dashboard/billing/actions.ts verifyPaymentAction) — if
// they close the tab right after paying, this is what still grants access.
// Also the ONLY path for Razorpay Subscriptions renewals after the first
// charge — those happen on Razorpay's own schedule with no browser
// involved at all, so subscription.charged has no client-side counterpart
// the way payment.captured does.
//
// Configure this URL (https://yourdomain/api/webhooks/razorpay) in the
// Razorpay dashboard's Webhooks settings with these events enabled:
// payment.captured, subscription.charged, subscription.pending,
// subscription.halted, subscription.cancelled — and copy the webhook
// secret it generates into RAZORPAY_WEBHOOK_SECRET (different from
// RAZORPAY_KEY_SECRET).
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: { entity?: { order_id?: string; id?: string; amount?: number; currency?: string } };
      subscription?: { entity?: { id?: string; status?: string } };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.event === "payment.captured") {
    await handlePaymentCaptured(event.payload?.payment?.entity);
  } else if (event.event === "subscription.charged") {
    await handleSubscriptionCharged(event.payload);
  } else if (event.event === "subscription.pending") {
    await handleSubscriptionStatus(event.payload?.subscription?.entity, "pending");
  } else if (event.event === "subscription.halted") {
    await handleSubscriptionStatus(event.payload?.subscription?.entity, "halted");
  } else if (event.event === "subscription.cancelled") {
    await handleSubscriptionStatus(event.payload?.subscription?.entity, "cancelled");
  }

  return NextResponse.json({ ok: true });
}

async function handlePaymentCaptured(payment?: { order_id?: string; id?: string }) {
  const orderId = payment?.order_id;
  const paymentId = payment?.id;
  if (!orderId || !paymentId) return;

  try {
    const { clinicId } = await confirmPayment({ razorpayOrderId: orderId, razorpayPaymentId: paymentId });
    revalidateTag(clinicCacheTag(clinicId));
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
  } catch (err) {
    // Log and still 200 the webhook — Razorpay retries on non-2xx, and if
    // this is a genuine "payment doc doesn't exist yet" race (the
    // order-creation call is still in flight), retries won't help beyond
    // what Razorpay already does. A missing/broken payment record here is
    // something to notice in logs, not to loop on.
    console.error("Failed to confirm payment from webhook:", err);
  }
}

async function handleSubscriptionCharged(payload?: {
  payment?: { entity?: { order_id?: string; id?: string; amount?: number; currency?: string } };
  subscription?: { entity?: { id?: string } };
}) {
  const payment = payload?.payment?.entity;
  const subscriptionId = payload?.subscription?.entity?.id;
  if (!payment?.id || !payment.order_id || !subscriptionId) return;

  const clinicId = await getClinicIdByRazorpaySubscriptionId(subscriptionId);
  if (!clinicId) {
    console.error(`subscription.charged for unknown subscription ${subscriptionId}`);
    return;
  }

  try {
    await recordSubscriptionCharge({
      clinicId,
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
      razorpaySubscriptionId: subscriptionId,
      amount: payment.amount ?? 0,
      currency: payment.currency ?? "INR",
    });
    // A successful charge means things are healthy again — clear the
    // dunning dedupe so a future pending/halted cycle emails fresh, and
    // mark the subscription itself active in case it was "pending" before
    // this retry succeeded.
    await updateClinicAutoRenew(clinicId, {
      razorpaySubscriptionStatus: "active",
      dunningEmailSentForStatus: null,
    });
    revalidateTag(clinicCacheTag(clinicId));
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
  } catch (err) {
    console.error("Failed to record subscription charge from webhook:", err);
  }
}

const DUNNING_SUBJECTS: Record<string, string> = {
  pending: "We couldn't process your Radiance Laser auto-renewal payment",
  halted: "Your Radiance Laser auto-renewal has been paused",
  cancelled: "Auto-renewal turned off for Radiance Laser",
};

async function handleSubscriptionStatus(
  subscription: { id?: string; status?: string } | undefined,
  status: "pending" | "halted" | "cancelled"
) {
  const subscriptionId = subscription?.id;
  if (!subscriptionId) return;

  const clinicId = await getClinicIdByRazorpaySubscriptionId(subscriptionId);
  if (!clinicId) {
    console.error(`subscription.${status} for unknown subscription ${subscriptionId}`);
    return;
  }

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { name: true, subscriptionRenewsAt: true, dunningEmailSentForStatus: true },
  });
  if (!clinic) return;

  await updateClinicAutoRenew(clinicId, {
    razorpaySubscriptionStatus: status,
    ...(status === "cancelled" ? { autoRenewEnabled: false } : {}),
  });
  revalidateTag(clinicCacheTag(clinicId));
  revalidatePath("/dashboard/settings");

  // Only ever one email per distinct status — a repeated "pending" webhook
  // (Razorpay retries several times before giving up) shouldn't re-send the
  // same email every time, but a genuine transition (pending -> halted, or
  // a fresh pending after a prior success) always sends a new one.
  if (clinic.dunningEmailSentForStatus === status) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    console.error("NEXT_PUBLIC_APP_URL is not set, skipping dunning email");
    return;
  }
  const billingUrl = `${appUrl}/dashboard/settings#billing`;

  const ownerEmails = await getClinicOwnerEmails([clinicId]);
  const ownerEmail = ownerEmails[clinicId];
  if (!ownerEmail) return;

  const html =
    status === "pending"
      ? paymentRetryingEmailHtml({ clinicName: clinic.name, billingUrl })
      : status === "halted"
        ? autoRenewHaltedEmailHtml({
            clinicName: clinic.name,
            renewsAt: Number(clinic.subscriptionRenewsAt ?? Date.now()),
            billingUrl,
          })
        : autoRenewCancelledEmailHtml({ clinicName: clinic.name, billingUrl });

  try {
    await sendEmail({ to: ownerEmail, subject: DUNNING_SUBJECTS[status], html });
    await updateClinicAutoRenew(clinicId, { dunningEmailSentForStatus: status });
  } catch (err) {
    console.error(`Failed to send ${status} dunning email for clinic ${clinicId}:`, err);
  }
}
