import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { prisma } from "@/lib/db/client";
import { updateClinicSubscription } from "@/lib/db/clinics";
import { SUBSCRIPTION_LENGTH_DAYS } from "@/lib/subscription";
import type { Payment } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function createPendingPayment(input: {
  clinicId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
}): Promise<string> {
  const docRef = adminDb().collection("payments").doc();
  const payment: Omit<Payment, "id"> = {
    clinicId: input.clinicId,
    razorpayOrderId: input.razorpayOrderId,
    amount: input.amount,
    currency: input.currency,
    status: "created",
    createdAt: Date.now(),
  };
  await docRef.set(payment);
  return docRef.id;
}

export async function getClinicPayments(clinicId: string): Promise<Payment[]> {
  // Needs a composite index (clinicId Ascending, createdAt Descending) —
  // same pattern as getPatients in lib/firestore/patients.ts.
  const snap = await adminDb()
    .collection("payments")
    .where("clinicId", "==", clinicId)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Payment);
}

/**
 * The one place that actually grants access after a payment — called from
 * both the client-side checkout verification
 * (app/dashboard/billing/actions.ts) and the Razorpay webhook
 * (app/api/webhooks/razorpay/route.ts), whichever arrives first. Idempotent
 * on the payment doc's own status: if it's already "paid" (the other path
 * got there first), this is a no-op rather than extending the clinic's paid
 * period twice for one payment.
 *
 * Looks the payment up by razorpayOrderId alone (Razorpay order IDs are
 * globally unique) rather than requiring the caller to already know which
 * clinic it belongs to — the webhook has no session to get that from.
 * expectedClinicId is an optional belt-and-suspenders check for the
 * session-authenticated path, so a signed-in owner can't confirm a payment
 * that isn't actually theirs by guessing/reusing someone else's order ID.
 *
 * Extends from the later of "now" or the clinic's current
 * subscriptionRenewsAt, not just "now + 1 year" — so renewing a few days
 * early (e.g. from the reminder banner) doesn't forfeit time already paid
 * for.
 *
 * Payment stays on Firestore; Clinic's subscription fields moved to
 * Postgres (see lib/db/clinics.ts) — the two can no longer be flipped in
 * one atomic transaction the way they were before that move, since they're
 * different databases. Instead: a Firestore-only transaction still does
 * the idempotency claim (payment "created" -> "paid") — that guard has to
 * stay atomic, since it's what stops the webhook and the client-side
 * callback from double-extending the clinic if both fire for the same
 * payment — and only once that transaction confirms *this* call actually
 * won the race does the Postgres write happen afterward. If the process
 * died between those two steps, the payment would be marked "paid" with
 * the clinic never actually extended — a narrow gap the previous
 * single-transaction version didn't have, worth knowing about even though
 * nothing here has hit it.
 */
export async function confirmPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  expectedClinicId?: string;
}): Promise<{ clinicId: string }> {
  const db = adminDb();

  const paymentsSnap = await db
    .collection("payments")
    .where("razorpayOrderId", "==", input.razorpayOrderId)
    .limit(1)
    .get();

  const paymentDoc = paymentsSnap.docs[0];
  if (!paymentDoc) {
    throw new Error(`No payment record found for order ${input.razorpayOrderId}`);
  }

  const paymentData = paymentDoc.data() as Payment;
  if (input.expectedClinicId && paymentData.clinicId !== input.expectedClinicId) {
    throw new Error("Payment does not belong to this clinic.");
  }

  if (paymentData.status === "paid") {
    return { clinicId: paymentData.clinicId }; // already processed by the other path
  }

  const claimed = await db.runTransaction(async (tx) => {
    const freshPayment = await tx.get(paymentDoc.ref);
    if ((freshPayment.data() as Payment).status === "paid") return false; // re-check inside the transaction

    tx.update(paymentDoc.ref, {
      status: "paid",
      razorpayPaymentId: input.razorpayPaymentId,
      paidAt: Date.now(),
    });
    return true;
  });

  if (!claimed) {
    return { clinicId: paymentData.clinicId }; // the other path won the race
  }

  const clinic = await prisma.clinic.findUnique({
    where: { id: paymentData.clinicId },
    select: { subscriptionRenewsAt: true },
  });
  const currentRenewsAt = Number(clinic?.subscriptionRenewsAt ?? 0);
  const newRenewsAt = Math.max(Date.now(), currentRenewsAt) + SUBSCRIPTION_LENGTH_DAYS * DAY_MS;

  await updateClinicSubscription(paymentData.clinicId, {
    subscriptionStatus: "active",
    subscriptionRenewsAt: newRenewsAt,
  });

  return { clinicId: paymentData.clinicId };
}
