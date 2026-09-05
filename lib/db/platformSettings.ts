import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/client";

// One row, always at this fixed id — see prisma/schema.prisma's
// PlatformSettings comment for why this isn't a per-clinic table.
const SETTINGS_ID = "global";

// Only used if the row is somehow missing (a fresh database before the
// first admin save) — never blocks the landing/signup/billing pages from
// rendering a price just because this hasn't been set yet.
const DEFAULT_ANNUAL_PRICE_INR = 20000;

export const PLATFORM_SETTINGS_CACHE_TAG = "platform-settings";

async function fetchAnnualPriceInr(): Promise<number> {
  const row = await prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } });
  return row?.annualPriceInr ?? DEFAULT_ANNUAL_PRICE_INR;
}

/**
 * The single source of truth for the software's annual price — read by the
 * landing page, signup page, dashboard billing section, and the Razorpay
 * order creation action, so changing it in one place (the super admin
 * panel) changes what every one of those shows and actually charges.
 * Cached across requests since it changes rarely; updatePlatformPricing
 * below invalidates it immediately via revalidateTag rather than waiting
 * out the revalidate window.
 */
export function getAnnualPriceInr(): Promise<number> {
  return unstable_cache(fetchAnnualPriceInr, ["annual-price-inr"], {
    tags: [PLATFORM_SETTINGS_CACHE_TAG],
    revalidate: 300,
  })();
}

export async function updatePlatformPricing(annualPriceInr: number, updatedByEmail: string): Promise<void> {
  const now = BigInt(Date.now());
  await prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, annualPriceInr, updatedAt: now, updatedByEmail },
    update: { annualPriceInr, updatedAt: now, updatedByEmail },
  });
}

export interface PlatformSettingsInfo {
  annualPriceInr: number;
  updatedAt: number | null;
  updatedByEmail: string | null;
}

/** Uncached, direct read — backs the admin page itself, which should
 * always show the true current value, not a stale cached one. */
export async function getPlatformSettingsInfo(): Promise<PlatformSettingsInfo> {
  const row = await prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } });
  return {
    annualPriceInr: row?.annualPriceInr ?? DEFAULT_ANNUAL_PRICE_INR,
    updatedAt: row?.updatedAt !== undefined && row?.updatedAt !== null ? Number(row.updatedAt) : null,
    updatedByEmail: row?.updatedByEmail ?? null,
  };
}
