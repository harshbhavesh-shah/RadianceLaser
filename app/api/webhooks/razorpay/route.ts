import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { confirmPayment } from "@/lib/firestore/payments";
import { clinicCacheTag } from "@/lib/firestore/clinics";

// Authoritative confirmation path for payments, independent of whether the
// customer's browser is still around to run the client-side success
// callback (app/dashboard/billing/actions.ts verifyPaymentAction) — if
// they close the tab right after paying, this is what still grants access.
// Configure this URL (https://yourdomain/api/webhooks/razorpay) and the
// "payment.captured" event in the Razorpay dashboard's Webhooks settings,
// and copy the webhook secret it generates into RAZORPAY_WEBHOOK_SECRET —
// that's a different value from RAZORPAY_KEY_SECRET.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { event?: string; payload?: { payment?: { entity?: { order_id?: string; id?: string } } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.event === "payment.captured") {
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.order_id;
    const paymentId = payment?.id;

    if (orderId && paymentId) {
      try {
        const { clinicId } = await confirmPayment({
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
        });
        revalidateTag(clinicCacheTag(clinicId));
        revalidatePath("/dashboard");
        revalidatePath("/dashboard/settings");
      } catch (err) {
        // Log and still 200 the webhook — Razorpay retries on non-2xx, and
        // if this is a genuine "payment doc doesn't exist yet" race (the
        // order-creation call is still in flight), retries won't help
        // beyond what Razorpay already does. A missing/broken payment
        // record here is something to notice in logs, not to loop on.
        console.error("Failed to confirm payment from webhook:", err);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
