import type { TierPricing } from "@/lib/db/platformSettings";

// Pure functions, no server-only import — used both from server actions
// (app/dashboard/billing/actions.ts, the authoritative price) and directly
// from the client BillingSection component (a live preview), so what an
// owner sees before paying always matches what actually gets charged.

export const PURCHASABLE_TIERS = ["basic", "standard", "pro", "enterprise"] as const;
export type PurchasableTier = (typeof PURCHASABLE_TIERS)[number];

export const ENTERPRISE_MIN_CENTERS = 2;
export const ENTERPRISE_MAX_CENTERS = 10;

/**
 * Interpolates the per-center *rate* linearly between the 2-center and
 * 10-center endpoints, not the total price, so the result is a genuine
 * deepening volume discount rather than an accidentally increasing
 * per-center price (the bug caught during the original pricing brainstorm).
 */
export function computeEnterprisePriceInr(centers: number, minPriceInr: number, maxPriceInr: number): number {
  const clamped = Math.min(ENTERPRISE_MAX_CENTERS, Math.max(ENTERPRISE_MIN_CENTERS, Math.round(centers)));
  const rateAt2 = minPriceInr / ENTERPRISE_MIN_CENTERS;
  const rateAt10 = maxPriceInr / ENTERPRISE_MAX_CENTERS;
  const t = (clamped - ENTERPRISE_MIN_CENTERS) / (ENTERPRISE_MAX_CENTERS - ENTERPRISE_MIN_CENTERS);
  const rate = rateAt2 + (rateAt10 - rateAt2) * t;
  return Math.round(rate * clamped);
}

/** The single source of truth for what a given purchasable tier actually
 * costs — both the checkout-charging code and the Billing page's live
 * preview call this, so the two numbers can never drift apart. */
export function getPurchaseTierPriceInr(
  tier: PurchasableTier,
  pricing: TierPricing,
  enterpriseCenters?: number
): number {
  if (tier === "basic") return pricing.basicPriceInr;
  if (tier === "standard") return pricing.standardPriceInr;
  if (tier === "pro") return pricing.proPriceInr;
  return computeEnterprisePriceInr(enterpriseCenters ?? ENTERPRISE_MIN_CENTERS, pricing.enterpriseMinPriceInr, pricing.enterpriseMaxPriceInr);
}
