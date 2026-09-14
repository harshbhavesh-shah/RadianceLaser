"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, RefreshCw } from "lucide-react";
import {
  cancelAutoRenewAction,
  createAutoRenewSubscriptionAction,
  createRenewalOrderAction,
  verifyPaymentAction,
  verifySubscriptionAction,
} from "@/app/dashboard/billing/actions";
import {
  PURCHASABLE_TIERS,
  ENTERPRISE_MIN_CENTERS,
  ENTERPRISE_MAX_CENTERS,
  getPurchaseTierPriceInr,
  type PurchasableTier,
} from "@/lib/pricing";
import type { TierPricing } from "@/lib/db/platformSettings";
import type { PlanTier } from "@/lib/entitlements";
import type { ClinicAccess } from "@/lib/subscription";
import type { Payment } from "@/types";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const RAZORPAY_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

const TIER_LABELS: Record<PurchasableTier, string> = {
  basic: "Basic",
  standard: "Standard",
  pro: "Pro",
  enterprise: "Enterprise",
};

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

function formatInr(inr: number): string {
  return `₹${inr.toLocaleString("en-IN")}`;
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
  tierPricing,
  currentTier,
  autoRenewEnabled,
  razorpaySubscriptionStatus,
  autoRenewPlanAmountInr,
}: {
  access: ClinicAccess;
  isOwner: boolean;
  clinicName: string;
  ownerEmail: string;
  payments: Payment[];
  tierPricing: TierPricing;
  currentTier: PlanTier;
  autoRenewEnabled: boolean;
  razorpaySubscriptionStatus?: string;
  autoRenewPlanAmountInr?: number;
}) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAutoRenewProcessing, setIsAutoRenewProcessing] = useState(false);
  const [autoRenewError, setAutoRenewError] = useState<string | null>(null);

  // Defaults to the clinic's current paid tier if it has one, otherwise
  // Basic — never Free, since Free isn't something you check out for.
  const [selectedTier, setSelectedTier] = useState<PurchasableTier>(
    currentTier === "free" ? "basic" : (currentTier as PurchasableTier)
  );
  const [enterpriseCenters, setEnterpriseCenters] = useState(ENTERPRISE_MIN_CENTERS);

  const selectedPriceInr = useMemo(
    () => getPurchaseTierPriceInr(selectedTier, tierPricing, enterpriseCenters),
    [selectedTier, tierPricing, enterpriseCenters]
  );

  async function handleSubscribe() {
    setIsProcessing(true);
    setError(null);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setError("Couldn't load the payment form. Check your connection and try again.");
        return;
      }

      const result = await createRenewalOrderAction(
        selectedTier,
        selectedTier === "enterprise" ? enterpriseCenters : undefined
      );
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
        description: `${clinicName}: ${TIER_LABELS[selectedTier]} annual subscription`,
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

  async function handleEnableAutoRenew() {
    setIsAutoRenewProcessing(true);
    setAutoRenewError(null);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setAutoRenewError("Couldn't load the payment form. Check your connection and try again.");
        return;
      }

      const result = await createAutoRenewSubscriptionAction(
        selectedTier,
        selectedTier === "enterprise" ? enterpriseCenters : undefined
      );
      if (result.error || !result.subscription) {
        setAutoRenewError(result.error || "Couldn't set up auto-renew.");
        return;
      }
      const { subscriptionId, keyId } = result.subscription;

      const razorpay = new window.Razorpay({
        key: keyId,
        subscription_id: subscriptionId,
        name: "Radiance Laser",
        description: `${clinicName}: ${TIER_LABELS[selectedTier]}, auto-renewing annually`,
        prefill: { email: ownerEmail },
        theme: { color: "#b45309" },
        handler: async (response: {
          razorpay_subscription_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verifyResult = await verifySubscriptionAction({
            subscriptionId: response.razorpay_subscription_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          });
          if (verifyResult.error) {
            setAutoRenewError(verifyResult.error);
          } else {
            router.refresh();
          }
        },
        modal: {
          ondismiss: () => setIsAutoRenewProcessing(false),
        },
      });
      razorpay.open();
    } catch (err) {
      console.error("Auto-renew setup failed:", err);
      setAutoRenewError("Something went wrong setting up auto-renew. Please try again.");
    } finally {
      setIsAutoRenewProcessing(false);
    }
  }

  async function handleCancelAutoRenew() {
    if (!confirm("Turn off auto-renew? Your access isn't affected, but you'll just need to renew manually going forward.")) {
      return;
    }
    setIsAutoRenewProcessing(true);
    setAutoRenewError(null);
    try {
      const result = await cancelAutoRenewAction();
      if (result.error) {
        setAutoRenewError(result.error);
      } else {
        router.refresh();
      }
    } finally {
      setIsAutoRenewProcessing(false);
    }
  }

  const autoRenewNeedsAttention = razorpaySubscriptionStatus === "pending" || razorpaySubscriptionStatus === "halted";

  return (
    <div id="billing" className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-medium text-brown-900">Billing</h2>
        <span className="rounded-full bg-beige-200 px-2.5 py-1 text-xs font-medium capitalize text-brown-600">
          {currentTier} plan
        </span>
      </div>

      <div className="mt-4 rounded-lg border border-beige-300 bg-canvas p-4">
        {access.status === "trialing" && (
          <p className="text-sm text-brown-700">
            Free trial:{" "}
            {access.daysRemaining <= 1 ? "ends tomorrow" : `${access.daysRemaining} days remaining`}.
          </p>
        )}
        {access.status === "active" && (
          <p className="text-sm text-brown-700">
            {access.renewsInDays !== undefined
              ? `Subscription active. Renew within ${access.renewsInDays} day${access.renewsInDays === 1 ? "" : "s"} to avoid interruption.`
              : "Subscription active."}
          </p>
        )}
        {access.status === "locked" && (
          <p className="text-sm text-red-700">
            Access is currently locked. Renew to resume adding or changing anything.
          </p>
        )}
      </div>

      {isOwner && (
        <div className="mt-3 rounded-lg border border-beige-300 bg-canvas p-4">
          <div className="text-sm font-medium text-brown-900">Choose a plan</div>
          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PURCHASABLE_TIERS.map((tier) => (
              <button
                key={tier}
                type="button"
                onClick={() => setSelectedTier(tier)}
                className={`rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  selectedTier === tier
                    ? "border-rust-600 bg-rust-100 text-brown-900"
                    : "border-beige-300 bg-surface text-brown-600 hover:border-rust-600"
                }`}
              >
                <div>{TIER_LABELS[tier]}</div>
                <div className="mt-0.5 font-normal text-brown-500">
                  {tier === "enterprise"
                    ? `From ${formatInr(tierPricing.enterpriseMinPriceInr)}`
                    : `${formatInr(getPurchaseTierPriceInr(tier, tierPricing))}/yr`}
                </div>
              </button>
            ))}
          </div>

          {selectedTier === "enterprise" && (
            <div className="mt-3 flex items-center gap-3">
              <label className="text-xs text-brown-600" htmlFor="enterprise-centers">
                Centers
              </label>
              <input
                id="enterprise-centers"
                type="number"
                min={ENTERPRISE_MIN_CENTERS}
                max={ENTERPRISE_MAX_CENTERS}
                value={enterpriseCenters}
                onChange={(e) => setEnterpriseCenters(Number(e.target.value))}
                className="w-16 rounded-md border border-beige-300 bg-surface px-2 py-1 text-sm text-brown-900 outline-none focus:border-rust-600"
              />
              <span className="text-xs text-brown-400">
                {ENTERPRISE_MIN_CENTERS}–{ENTERPRISE_MAX_CENTERS} locations
              </span>
            </div>
          )}

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleSubscribe}
              disabled={isProcessing}
              className="flex items-center gap-2 rounded-md bg-rust-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rust-700 disabled:opacity-50"
            >
              <CreditCard size={16} />
              {isProcessing
                ? "Opening checkout…"
                : `Subscribe to ${TIER_LABELS[selectedTier]}: ${formatInr(selectedPriceInr)}/year`}
            </button>
            {error && <span className="text-sm text-red-700">{error}</span>}
          </div>
        </div>
      )}
      {!isOwner && (
        <p className="mt-3 text-xs text-brown-400">Only the clinic owner can manage billing.</p>
      )}

      {isOwner && (
        <div
          className={`mt-3 rounded-lg border p-4 ${
            autoRenewNeedsAttention ? "border-red-300 bg-red-50" : "border-beige-300 bg-canvas"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-brown-900">
                <RefreshCw size={15} className="flex-shrink-0" />
                Auto-renew
              </div>
              {autoRenewEnabled ? (
                <p className="mt-1 text-xs text-brown-400">
                  {razorpaySubscriptionStatus === "halted"
                    ? "Payment retries failed. Auto-renew has stopped. Update your payment method or renew manually."
                    : razorpaySubscriptionStatus === "pending"
                      ? "A charge attempt failed. Razorpay is automatically retrying."
                      : autoRenewPlanAmountInr !== undefined
                        ? `On: ${formatInr(autoRenewPlanAmountInr)}/year, charged automatically.`
                        : "On, charged automatically each year."}
                </p>
              ) : (
                <p className="mt-1 text-xs text-brown-400">
                  Off. Renew manually using the plan picker above, or turn this on to charge the
                  selected plan automatically each year.
                </p>
              )}
            </div>
            <button
              onClick={autoRenewEnabled ? handleCancelAutoRenew : handleEnableAutoRenew}
              disabled={isAutoRenewProcessing}
              className={`flex-shrink-0 rounded-md px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                autoRenewEnabled
                  ? "border border-beige-300 text-brown-700 hover:bg-beige-100"
                  : "bg-rust-600 text-white hover:bg-rust-700"
              }`}
            >
              {isAutoRenewProcessing ? "Working…" : autoRenewEnabled ? "Turn off" : "Turn on"}
            </button>
          </div>
          {autoRenewError && <p className="mt-2 text-xs text-red-700">{autoRenewError}</p>}
        </div>
      )}

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
                  <div className="flex items-center gap-2 text-brown-900">
                    {formatAmount(p.amount)}
                    {p.planTier && (
                      <span className="rounded-full bg-beige-200 px-2 py-0.5 text-[11px] font-medium capitalize text-brown-600">
                        {p.planTier}
                      </span>
                    )}
                  </div>
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
