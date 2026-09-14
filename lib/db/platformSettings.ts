import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/client";

// One row, always at this fixed id — see prisma/schema.prisma's
// PlatformSettings comment for why this isn't a per-clinic table.
const SETTINGS_ID = "global";

// Only used if the row is somehow missing (a fresh database before the
// first admin save) — these are also the numbers the landing page showed
// as plain hardcoded copy before tier pricing became admin-editable, so a
// fresh database renders exactly what it always did.
const DEFAULT_BASIC_PRICE_INR = 15000;
const DEFAULT_STANDARD_PRICE_INR = 25000;
const DEFAULT_PRO_PRICE_INR = 30000;
const DEFAULT_ENTERPRISE_MIN_PRICE_INR = 50000;
const DEFAULT_ENTERPRISE_MAX_PRICE_INR = 200000;

export const PLATFORM_SETTINGS_CACHE_TAG = "platform-settings";

export interface TierPricing {
  basicPriceInr: number;
  standardPriceInr: number;
  proPriceInr: number;
  enterpriseMinPriceInr: number;
  enterpriseMaxPriceInr: number;
}

async function fetchTierPricing(): Promise<TierPricing> {
  const row = await prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } });
  return {
    basicPriceInr: row?.basicPriceInr ?? DEFAULT_BASIC_PRICE_INR,
    standardPriceInr: row?.standardPriceInr ?? DEFAULT_STANDARD_PRICE_INR,
    proPriceInr: row?.proPriceInr ?? DEFAULT_PRO_PRICE_INR,
    enterpriseMinPriceInr: row?.enterpriseMinPriceInr ?? DEFAULT_ENTERPRISE_MIN_PRICE_INR,
    enterpriseMaxPriceInr: row?.enterpriseMaxPriceInr ?? DEFAULT_ENTERPRISE_MAX_PRICE_INR,
  };
}

/**
 * The single source of truth for what every paid tier actually costs —
 * read by the landing page's pricing section, real checkout
 * (app/dashboard/billing/actions.ts), and the admin's manual activation
 * flow. Free is always ₹0 and isn't stored. Cached across requests since it
 * changes rarely; updateTierPricing below invalidates it immediately via
 * revalidateTag rather than waiting out the revalidate window.
 */
export function getTierPricing(): Promise<TierPricing> {
  return unstable_cache(fetchTierPricing, ["tier-pricing"], {
    tags: [PLATFORM_SETTINGS_CACHE_TAG],
    revalidate: 300,
  })();
}

export async function updateTierPricing(pricing: TierPricing, updatedByEmail: string): Promise<void> {
  const now = BigInt(Date.now());
  await prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...pricing, updatedAt: now, updatedByEmail },
    update: { ...pricing, updatedAt: now, updatedByEmail },
  });
}

export interface PlatformSettingsInfo extends TierPricing {
  updatedAt: number | null;
  updatedByEmail: string | null;
}

/** Uncached, direct read — backs the admin page itself, which should
 * always show the true current value, not a stale cached one. */
export async function getPlatformSettingsInfo(): Promise<PlatformSettingsInfo> {
  const row = await prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } });
  return {
    basicPriceInr: row?.basicPriceInr ?? DEFAULT_BASIC_PRICE_INR,
    standardPriceInr: row?.standardPriceInr ?? DEFAULT_STANDARD_PRICE_INR,
    proPriceInr: row?.proPriceInr ?? DEFAULT_PRO_PRICE_INR,
    enterpriseMinPriceInr: row?.enterpriseMinPriceInr ?? DEFAULT_ENTERPRISE_MIN_PRICE_INR,
    enterpriseMaxPriceInr: row?.enterpriseMaxPriceInr ?? DEFAULT_ENTERPRISE_MAX_PRICE_INR,
    updatedAt: row?.updatedAt !== undefined && row?.updatedAt !== null ? Number(row.updatedAt) : null,
    updatedByEmail: row?.updatedByEmail ?? null,
  };
}
