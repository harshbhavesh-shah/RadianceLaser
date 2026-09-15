import { describe, it, expect } from "vitest";
import { getEntitlements, getClinicTier, tierAtLeast, TIER_ENTITLEMENTS, type PlanTier } from "@/lib/entitlements";

// A bug here means a clinic either loses access to something they paid for
// (a support ticket) or keeps a feature they didn't pay for (lost revenue).
// Every check that gates a real page/action in the app ultimately reduces to
// one of these three pure functions, so pinning them down here is what
// actually protects the tier ladder, not the individual `if` checks
// scattered across pages.

describe("getEntitlements", () => {
  it("free tier has no paid features and a patient/staff cap", () => {
    const e = getEntitlements("free");
    expect(e.maxPatients).toBe(500);
    expect(e.maxStaff).toBe(2);
    expect(e.analytics).toBe(false);
    expect(e.inventory).toBe(false);
    expect(e.whatsappAutomation).toBe(false);
    expect(e.patientRetention).toBe(false);
  });

  it("every tier at or above basic has unlimited patients", () => {
    for (const tier of ["basic", "standard", "pro", "enterprise"] as PlanTier[]) {
      expect(getEntitlements(tier).maxPatients).toBeNull();
    }
  });

  it("whatsappAutomation (the Inbox) only unlocks at pro and above, not basic/standard", () => {
    expect(getEntitlements("basic").whatsappAutomation).toBe(false);
    expect(getEntitlements("standard").whatsappAutomation).toBe(false);
    expect(getEntitlements("pro").whatsappAutomation).toBe(true);
    expect(getEntitlements("enterprise").whatsappAutomation).toBe(true);
  });

  it("patientRetention (No Shows / Follow-Ups) unlocks at standard, not basic", () => {
    expect(getEntitlements("basic").patientRetention).toBe(false);
    expect(getEntitlements("standard").patientRetention).toBe(true);
  });

  it("staff cap only lifts at standard and above, not basic", () => {
    expect(getEntitlements("basic").maxStaff).toBe(2);
    expect(getEntitlements("standard").maxStaff).toBeNull();
  });

  it("every tier is a strict superset of the tier below it (the Apple-ladder guarantee)", () => {
    const order: PlanTier[] = ["free", "basic", "standard", "pro", "enterprise"];
    const booleanKeys = [
      "analytics",
      "inventory",
      "whatsappConnect",
      "whatsappAutomation",
      "photos",
      "customMachineTypes",
      "patientRetention",
      "customPackageTypes",
    ] as const;
    for (let i = 1; i < order.length; i++) {
      const lower = TIER_ENTITLEMENTS[order[i - 1]];
      const higher = TIER_ENTITLEMENTS[order[i]];
      for (const key of booleanKeys) {
        // A higher tier must never take a feature away that a lower tier had.
        if (lower[key]) expect(higher[key]).toBe(true);
      }
    }
  });

  it("enterprise is entitlement-identical to pro — the only difference is billing", () => {
    expect(getEntitlements("enterprise")).toEqual(getEntitlements("pro"));
  });
});

describe("getClinicTier", () => {
  it("gives a trialing clinic full pro-level access while the trial is still running", () => {
    const tier = getClinicTier({ subscriptionStatus: "trialing", trialEndsAt: Date.now() + 10_000 });
    expect(tier).toBe("pro");
  });

  it("falls back to free once a trialing clinic's trial has actually expired", () => {
    const tier = getClinicTier({ subscriptionStatus: "trialing", trialEndsAt: Date.now() - 10_000 });
    expect(tier).toBe("free");
  });

  it("uses the clinic's real planTier once active", () => {
    expect(getClinicTier({ subscriptionStatus: "active", trialEndsAt: 0, planTier: "standard" })).toBe("standard");
  });

  it("falls back to free for an active clinic with no planTier set", () => {
    expect(getClinicTier({ subscriptionStatus: "active", trialEndsAt: 0, planTier: null })).toBe("free");
  });

  it("a locked/canceled clinic still reports its real tier, not free — write access is a separate check", () => {
    expect(getClinicTier({ subscriptionStatus: "canceled", trialEndsAt: 0, planTier: "pro" })).toBe("pro");
  });
});

describe("tierAtLeast", () => {
  it("is true when the tier meets or exceeds the minimum", () => {
    expect(tierAtLeast("pro", "basic")).toBe(true);
    expect(tierAtLeast("basic", "basic")).toBe(true);
  });

  it("is false when the tier is below the minimum", () => {
    expect(tierAtLeast("free", "basic")).toBe(false);
    expect(tierAtLeast("basic", "standard")).toBe(false);
  });
});
