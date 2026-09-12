import "server-only";
import { prisma } from "@/lib/db/client";
import { SUBSCRIPTION_LENGTH_DAYS } from "@/lib/subscription";
import type { Payment as PrismaPaymentRow } from "@prisma/client";
import type { Payment } from "@/types";

// Postgres migration, chunk 12 (post-launch cleanup, going Firestore-free
// past the original 11-chunk migration) — Payment. Function names/
// signatures intentionally match lib/firestore/payments.ts as closely as
// possible.

const DAY_MS = 24 * 60 * 60 * 1000;

function toPayment(row: PrismaPaymentRow): Payment {
  return {
    id: row.id,
    clinicId: row.clinicId,
    razorpayOrderId: row.razorpayOrderId,
    amount: row.amount,
    currency: row.currency,
    status: row.status as Payment["status"],
    createdAt: Number(row.createdAt),
    ...(row.razorpayPaymentId ? { razorpayPaymentId: row.razorpayPaymentId } : {}),
    ...(row.razorpaySubscriptionId ? { razorpaySubscriptionId: row.razorpaySubscriptionId } : {}),
    ...(row.paidAt !== null ? { paidAt: Number(row.paidAt) } : {}),
  };
}

export async function createPendingPayment(input: {
  clinicId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
}): Promise<string> {
  const row = await prisma.payment.create({
    data: {
      clinicId: input.clinicId,
      razorpayOrderId: input.razorpayOrderId,
      amount: input.amount,
      currency: input.currency,
      status: "created",
      createdAt: BigInt(Date.now()),
    },
  });
  return row.id;
}

export async function getClinicPayments(clinicId: string): Promise<Payment[]> {
  const rows = await prisma.payment.findMany({ where: { clinicId }, orderBy: { createdAt: "desc" } });
  return rows.map(toPayment);
}

/** Every successfully completed payment across every clinic — backs
 * app/admin/analytics, the platform-wide (not per-clinic) revenue view. */
export async function getAllPaidPayments(): Promise<Payment[]> {
  const rows = await prisma.payment.findMany({ where: { status: "paid" }, orderBy: { paidAt: "asc" } });
  return rows.map(toPayment);
}

/**
 * The one place that actually grants access after a payment — called from
 * both the client-side checkout verification
 * (app/dashboard/billing/actions.ts) and the Razorpay webhook
 * (app/api/webhooks/razorpay/route.ts), whichever arrives first. Idempotent
 * on the payment row's own status: if it's already "paid" (the other path
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
 * Now that Payment and Clinic both live in Postgres, claiming the payment
 * and extending the subscription happen inside one real database
 * transaction — a genuine improvement over the Firestore-transaction-
 * then-separate-Postgres-write this used while the two tables were split
 * across databases (see git history).
 */
export async function confirmPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  expectedClinicId?: string;
}): Promise<{ clinicId: string }> {
  const payment = await prisma.payment.findFirst({ where: { razorpayOrderId: input.razorpayOrderId } });
  if (!payment) {
    throw new Error(`No payment record found for order ${input.razorpayOrderId}`);
  }
  if (input.expectedClinicId && payment.clinicId !== input.expectedClinicId) {
    throw new Error("Payment does not belong to this clinic.");
  }
  if (payment.status === "paid") {
    return { clinicId: payment.clinicId }; // already processed by the other path
  }

  await prisma.$transaction(async (tx) => {
    // Re-check inside the transaction — this is the same idempotency guard
    // against the webhook and the client-side callback both racing to
    // confirm the same payment that the old Firestore transaction provided.
    const fresh = await tx.payment.findUnique({ where: { id: payment.id }, select: { status: true } });
    if (fresh?.status === "paid") return; // the other path won the race

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "paid", razorpayPaymentId: input.razorpayPaymentId, paidAt: BigInt(Date.now()) },
    });

    const clinic = await tx.clinic.findUnique({
      where: { id: payment.clinicId },
      select: { subscriptionRenewsAt: true },
    });
    const currentRenewsAt = Number(clinic?.subscriptionRenewsAt ?? 0);
    const newRenewsAt = Math.max(Date.now(), currentRenewsAt) + SUBSCRIPTION_LENGTH_DAYS * DAY_MS;

    await tx.clinic.update({
      where: { id: payment.clinicId },
      data: { subscriptionStatus: "active", subscriptionRenewsAt: BigInt(newRenewsAt) },
    });
  });

  return { clinicId: payment.clinicId };
}

/**
 * The Razorpay-Subscriptions equivalent of confirmPayment above — called
 * both from the client-side checkout callback (the subscription's first
 * charge, verifySubscriptionAction) and the `subscription.charged` webhook
 * (every renewal after that, and the authoritative fallback for the first
 * one too if the browser closes right after paying). Unlike the manual
 * flow, there's no pre-created "created" Payment row to update — a
 * subscription charge just happens on Razorpay's own schedule — so this
 * creates the Payment row itself, and extends subscriptionRenewsAt exactly
 * like confirmPayment does (from the later of "now" or the current
 * renewsAt, never forfeiting time already paid for).
 *
 * Idempotent on razorpayPaymentId (checked fresh inside the transaction,
 * same race-guard reasoning as confirmPayment) — Razorpay webhooks are
 * at-least-once delivery, and this can also race against the client-side
 * callback confirming the very same first charge.
 */
export async function recordSubscriptionCharge(input: {
  clinicId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySubscriptionId: string;
  amount: number;
  currency: string;
}): Promise<{ alreadyRecorded: boolean }> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findFirst({
      where: { razorpayPaymentId: input.razorpayPaymentId },
      select: { id: true },
    });
    if (existing) return { alreadyRecorded: true };

    const now = BigInt(Date.now());
    await tx.payment.create({
      data: {
        clinicId: input.clinicId,
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
        razorpaySubscriptionId: input.razorpaySubscriptionId,
        amount: input.amount,
        currency: input.currency,
        status: "paid",
        createdAt: now,
        paidAt: now,
      },
    });

    const clinic = await tx.clinic.findUnique({
      where: { id: input.clinicId },
      select: { subscriptionRenewsAt: true },
    });
    const currentRenewsAt = Number(clinic?.subscriptionRenewsAt ?? 0);
    const newRenewsAt = Math.max(Date.now(), currentRenewsAt) + SUBSCRIPTION_LENGTH_DAYS * DAY_MS;

    await tx.clinic.update({
      where: { id: input.clinicId },
      data: { subscriptionStatus: "active", subscriptionRenewsAt: BigInt(newRenewsAt) },
    });

    return { alreadyRecorded: false };
  });
}
