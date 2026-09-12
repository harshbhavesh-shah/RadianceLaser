// The single source of truth for "what can this clinic actually use right
// now" — Phase A of the tier system (see the published pricing playbook for
// the full ladder). Deliberately separate from lib/subscription.ts's
// getClinicAccess(): that answers "can they write at all" (trial/active/
// locked), this answers "which features/caps apply" once they can. No
// "server-only" import — these are pure functions with no DB/env access,
// safe to import from server actions, pages, and admin code; never import
// this directly from a client component, though (compute the tier
// server-side and pass it down as a prop, the way app/dashboard/layout.tsx
// does for Sidebar).

export type PlanTier = "free" | "basic" | "standard" | "pro" | "enterprise";

export interface TierEntitlements {
  maxPatients: number | null; // null = unlimited
  maxStaff: number | null; // null = unlimited
  analytics: boolean;
  inventory: boolean;
  whatsappConnect: boolean; // connect a number + manual sending
  whatsappAutomation: boolean; // two-way Inbox + auto reminder/feedback sends
  photos: boolean;
  customMachineTypes: boolean; // creating a genuinely new machine/treatment type
  patientRetention: boolean; // No-Shows / Follow-Ups pages
  customPackageTypes: boolean;
}

const TIER_ORDER: PlanTier[] = ["free", "basic", "standard", "pro", "enterprise"];

// Cumulative by design — each tier is meant to be a superset of the one
// below it (see the pricing playbook's Apple-ladder reasoning). Enterprise
// is entitlement-identical to Pro; the only difference is billing
// (Clinic.enterpriseCenters), which this phase doesn't gate on at all.
export const TIER_ENTITLEMENTS: Record<PlanTier, TierEntitlements> = {
  free: {
    maxPatients: 500,
    maxStaff: 2,
    analytics: false,
    inventory: false,
    whatsappConnect: false,
    whatsappAutomation: false,
    photos: false,
    customMachineTypes: false,
    patientRetention: false,
    customPackageTypes: false,
  },
  basic: {
    maxPatients: null,
    maxStaff: 2,
    analytics: true,
    inventory: true,
    whatsappConnect: true,
    whatsappAutomation: false,
    photos: true,
    customMachineTypes: true,
    patientRetention: false,
    customPackageTypes: false,
  },
  standard: {
    maxPatients: null,
    maxStaff: null,
    analytics: true,
    inventory: true,
    whatsappConnect: true,
    whatsappAutomation: false,
    photos: true,
    customMachineTypes: true,
    patientRetention: true,
    customPackageTypes: true,
  },
  pro: {
    maxPatients: null,
    maxStaff: null,
    analytics: true,
    inventory: true,
    whatsappConnect: true,
    whatsappAutomation: true,
    photos: true,
    customMachineTypes: true,
    patientRetention: true,
    customPackageTypes: true,
  },
  enterprise: {
    maxPatients: null,
    maxStaff: null,
    analytics: true,
    inventory: true,
    whatsappConnect: true,
    whatsappAutomation: true,
    photos: true,
    customMachineTypes: true,
    patientRetention: true,
    customPackageTypes: true,
  },
};

export function getEntitlements(tier: PlanTier): TierEntitlements {
  return TIER_ENTITLEMENTS[tier];
}

/**
 * A brand-new trial gets full Pro-level access without ever touching
 * planTier — clinics should feel the whole product before deciding whether
 * to pay for it. Once trialEndsAt passes, this already falls back to
 * "free" even before app/api/cron/expire-trials next runs: that cron is
 * what makes the free tier *permanent* (flips subscriptionStatus to
 * "active" so lib/subscription.ts's getClinicAccess() stops showing a
 * locked/trialing state), but this function alone is a safety net for the
 * gap between expiry and the next cron run — it only ever controls
 * entitlements, never write access/lockout.
 */
export function getClinicTier(clinic: {
  subscriptionStatus: string;
  trialEndsAt: number;
  planTier?: PlanTier | null;
}): PlanTier {
  if (clinic.subscriptionStatus === "trialing") {
    return clinic.trialEndsAt > Date.now() ? "pro" : "free";
  }
  // Covers "active" and the "canceled"/locked fallback alike — a locked
  // clinic's writes are already blocked by getClinicAccess() regardless of
  // tier, but reads (e.g. rendering the sidebar before the lock notice)
  // still call this, so fall back to whatever tier they were actually on
  // rather than unconditionally "free".
  return clinic.planTier ?? "free";
}

export function tierAtLeast(tier: PlanTier, min: PlanTier): boolean {
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(min);
}
