import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getClinicAccess, getClinicDeadline, REMINDER_THRESHOLD_DAYS } from "@/lib/subscription";

// This is the actual "can this clinic use the product right now" decision —
// get the boundary wrong and a paying clinic gets locked out (a real support
// ticket and a churn risk), or a lapsed one keeps writing for free. Every
// case below is a real state a clinic can be in, not a hypothetical.

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-06-15T12:00:00Z").getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getClinicAccess", () => {
  it("a trialing clinic with time left is trialing, with days remaining rounded up", () => {
    const access = getClinicAccess({
      subscriptionStatus: "trialing",
      trialEndsAt: NOW + 2.5 * DAY_MS,
      subscriptionRenewsAt: undefined,
    });
    expect(access).toEqual({ status: "trialing", daysRemaining: 3 });
  });

  it("a trialing clinic whose trial end has passed is locked, not still trialing", () => {
    const access = getClinicAccess({
      subscriptionStatus: "trialing",
      trialEndsAt: NOW - 1,
      subscriptionRenewsAt: undefined,
    });
    expect(access).toEqual({ status: "locked" });
  });

  it("a trialing clinic at the exact expiry instant is locked (boundary is exclusive)", () => {
    const access = getClinicAccess({
      subscriptionStatus: "trialing",
      trialEndsAt: NOW,
      subscriptionRenewsAt: undefined,
    });
    expect(access.status).toBe("locked");
  });

  it("an active clinic well before renewal shows plain active, no nagging", () => {
    const access = getClinicAccess({
      subscriptionStatus: "active",
      trialEndsAt: 0,
      subscriptionRenewsAt: NOW + 60 * DAY_MS,
    });
    expect(access).toEqual({ status: "active" });
  });

  it("an active clinic inside the reminder window surfaces renewsInDays", () => {
    const access = getClinicAccess({
      subscriptionStatus: "active",
      trialEndsAt: 0,
      subscriptionRenewsAt: NOW + (REMINDER_THRESHOLD_DAYS - 1) * DAY_MS,
    });
    expect(access.status).toBe("active");
    expect((access as { renewsInDays?: number }).renewsInDays).toBe(REMINDER_THRESHOLD_DAYS - 1);
  });

  it("an active clinic exactly at the reminder threshold still gets the reminder (inclusive)", () => {
    const access = getClinicAccess({
      subscriptionStatus: "active",
      trialEndsAt: 0,
      subscriptionRenewsAt: NOW + REMINDER_THRESHOLD_DAYS * DAY_MS,
    });
    expect((access as { renewsInDays?: number }).renewsInDays).toBe(REMINDER_THRESHOLD_DAYS);
  });

  it("an active clinic past its renewal date is locked — no separate cron flips this, the date comparison does", () => {
    const access = getClinicAccess({
      subscriptionStatus: "active",
      trialEndsAt: 0,
      subscriptionRenewsAt: NOW - 1,
    });
    expect(access).toEqual({ status: "locked" });
  });

  it("an active clinic with no renewsAt at all is not locked out over missing data", () => {
    const access = getClinicAccess({
      subscriptionStatus: "active",
      trialEndsAt: 0,
      subscriptionRenewsAt: undefined,
    });
    expect(access).toEqual({ status: "active" });
  });

  it("a canceled clinic is always locked, regardless of any dates", () => {
    const access = getClinicAccess({
      subscriptionStatus: "canceled",
      trialEndsAt: NOW + 1000 * DAY_MS,
      subscriptionRenewsAt: NOW + 1000 * DAY_MS,
    });
    expect(access).toEqual({ status: "locked" });
  });
});

describe("getClinicDeadline", () => {
  it("is the trial end date while trialing", () => {
    expect(
      getClinicDeadline({ subscriptionStatus: "trialing", trialEndsAt: 12345, subscriptionRenewsAt: undefined })
    ).toBe(12345);
  });

  it("is the renewal date while active", () => {
    expect(
      getClinicDeadline({ subscriptionStatus: "active", trialEndsAt: 0, subscriptionRenewsAt: 67890 })
    ).toBe(67890);
  });

  it("is null for an active clinic with no renewal date on record", () => {
    expect(
      getClinicDeadline({ subscriptionStatus: "active", trialEndsAt: 0, subscriptionRenewsAt: undefined })
    ).toBeNull();
  });

  it("is null once canceled/locked — that's a 'not paying' problem, not a 'coming due' one", () => {
    expect(
      getClinicDeadline({ subscriptionStatus: "canceled", trialEndsAt: 999, subscriptionRenewsAt: 999 })
    ).toBeNull();
  });
});
