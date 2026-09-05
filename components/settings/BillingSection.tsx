"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { createRenewalOrderAction, verifyPaymentAction } from "@/app/dashboard/billing/actions";
import type { ClinicAccess } from "@/lib/subscription";
import type { Payment } from "@/types";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const RAZORPAY_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function formatAmount(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

const STATUS_LABEL: Record<Payment["status"], string> = {
  created: "Started",
  paid: "Paid",
  failed: "Failed",
};

export default function BillingSection({
  access,
  isOwner,
  clinicName,
  ownerEmail,
  payments,
  annualPriceInr,
}: {
  access: ClinicAccess;
  isOwner: boolean;
  clinicName: string;
  ownerEmail: string;
  payments: Payment[];
  annualPriceInr: number;
}) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setIsProcessing(true);
    setError(null);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setError("Couldn't load the payment form. Check your connection and try again.");
        return;
      }

      const result = await createRenewalOrderAction();
      if (result.error || !result.order) {
        setError(result.error || "Couldn't start checkout.");
        return;
      }
      const { orderId, amount, currency, keyId } = result.order;

      const razorpay = new window.Razorpay({
        key: keyId,
        order_id: orderId,
        amount,
        currency,
        name: "Radiance Laser",
        description: `${clinicName} — annual subscription`,
        prefill: { email: ownerEmail },
        theme: { color: "#b45309" },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verifyResult = await verifyPaymentAction({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          });
          if (verifyResult.error) {
            setError(verifyResult.error);
          } else {
            router.refresh();
          }
        },
        modal: {
          ondismiss: () => setIsProcessing(false),
        },
      });
      razorpay.open();
    } catch (err) {
      console.error("Checkout failed:", err);
      setError("Something went wrong starting checkout. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div id="billing" className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <h2 className="font-display text-lg font-medium text-brown-900">Billing</h2>

      <div className="mt-4 rounded-lg border border-beige-300 bg-canvas p-4">
        {access.status === "trialing" && (
          <p className="text-sm text-brown-700">
            Free trial —{" "}
            {access.daysRemaining <= 1 ? "ends tomorrow" : `${access.daysRemaining} days remaining`}.
          </p>
        )}
        {access.status === "active" && (
          <p className="text-sm text-brown-700">
            {access.renewsInDays !== undefined
              ? `Subscription active — renew within ${access.renewsInDays} day${access.renewsInDays === 1 ? "" : "s"} to avoid interruption.`
              : "Subscription active."}
          </p>
        )}
        {access.status === "locked" && (
          <p className="text-sm text-red-700">
            Access is currently locked — renew to resume adding or changing anything.
          </p>
        )}

        {isOwner && (
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleSubscribe}
              disabled={isProcessing}
              className="flex items-center gap-2 rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-50"
            >
              <CreditCard size={16} />
              {isProcessing ? "Opening checkout…" : `Subscribe — ₹${annualPriceInr.toLocaleString("en-IN")}/year`}
            </button>
            {error && <span className="text-sm text-red-700">{error}</span>}
          </div>
        )}
        {!isOwner && (
          <p className="mt-2 text-xs text-brown-400">Only the clinic owner can manage billing.</p>
        )}
      </div>

      {payments.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brown-400">
            Payment History
          </h3>
          <div className="space-y-2">
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-beige-300 px-4 py-2.5 text-sm"
              >
                <div>
                  <div className="text-brown-900">{formatAmount(p.amount)}</div>
                  <div className="text-xs text-brown-400">{formatDate(p.createdAt)}</div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    p.status === "paid"
                      ? "bg-green-100 text-green-800"
                      : p.status === "failed"
                        ? "bg-red-100 text-red-800"
                        : "bg-beige-200 text-brown-600"
                  }`}
                >
                  {STATUS_LABEL[p.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
