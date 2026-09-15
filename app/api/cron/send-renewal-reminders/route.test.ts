import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { createClinic } from "@/lib/db/clinics";

const sendEmail = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/email/resend", () => ({ sendEmail }));

const { GET, buildReminderCandidates, sendReminderForCandidate } = await import("./route");

const DAY_MS = 24 * 60 * 60 * 1000;

describe("buildReminderCandidates (pure — no DB)", () => {
  const now = Date.now();

  function trialingClinic(overrides: Partial<Parameters<typeof buildReminderCandidates>[0][number]> = {}) {
    return {
      id: "c1",
      name: "Test Clinic",
      subscriptionStatus: "trialing",
      trialEndsAt: BigInt(now + 3 * DAY_MS),
      subscriptionRenewsAt: null,
      renewalReminderSentForDeadline: null,
      ...overrides,
    };
  }

  it("includes a trialing clinic whose deadline is inside the reminder window", () => {
    const candidates = buildReminderCandidates([trialingClinic({ trialEndsAt: BigInt(now + 3 * DAY_MS) })], now);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ id: "c1", isTrial: true });
  });

  it("excludes a trialing clinic whose deadline is further out than the reminder threshold", () => {
    const candidates = buildReminderCandidates([trialingClinic({ trialEndsAt: BigInt(now + 20 * DAY_MS) })], now);
    expect(candidates).toHaveLength(0);
  });

  it("excludes a clinic whose deadline has already passed (locked, not 'coming due')", () => {
    const candidates = buildReminderCandidates([trialingClinic({ trialEndsAt: BigInt(now - DAY_MS) })], now);
    expect(candidates).toHaveLength(0);
  });

  it("excludes a clinic already reminded for this exact deadline", () => {
    const deadline = now + 3 * DAY_MS;
    const candidates = buildReminderCandidates(
      [trialingClinic({ trialEndsAt: BigInt(deadline), renewalReminderSentForDeadline: BigInt(deadline) })],
      now
    );
    expect(candidates).toHaveLength(0);
  });

  it("re-includes a clinic once a NEW deadline is due, even if an older one was already reminded", () => {
    const oldDeadline = now - 100 * DAY_MS;
    const newDeadline = now + 3 * DAY_MS;
    const candidates = buildReminderCandidates(
      [
        trialingClinic({
          subscriptionStatus: "active",
          subscriptionRenewsAt: BigInt(newDeadline),
          renewalReminderSentForDeadline: BigInt(oldDeadline),
        }),
      ],
      now
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].isTrial).toBe(false);
  });

  it("excludes a canceled clinic — getClinicDeadline returns null, nothing 'coming due'", () => {
    const candidates = buildReminderCandidates([trialingClinic({ subscriptionStatus: "canceled" })], now);
    expect(candidates).toHaveLength(0);
  });

  it("excludes an active clinic with no subscriptionRenewsAt (auto-renew, or never set) — nothing to warn about", () => {
    const candidates = buildReminderCandidates(
      [trialingClinic({ subscriptionStatus: "active", subscriptionRenewsAt: null })],
      now
    );
    expect(candidates).toHaveLength(0);
  });
});

describe("send-renewal-reminders cron (integration, real Postgres; email mocked)", () => {
  const TEST_PREFIX = `_test_renewal_reminders_${Date.now()}`;
  const seededClinicIds: string[] = [];

  beforeAll(async () => {
    const stale = await prisma.clinic.findMany({
      where: { name: { startsWith: "_test_renewal_reminders_" } },
      select: { id: true },
    });
    if (stale.length) await prisma.clinic.deleteMany({ where: { id: { in: stale.map((c) => c.id) } } });
  });

  afterAll(async () => {
    await prisma.clinic.deleteMany({ where: { id: { in: seededClinicIds } } });
  });

  beforeEach(() => {
    sendEmail.mockClear();
  });

  it("GET rejects a request without the right bearer token, before querying any clinic", async () => {
    const req = new NextRequest("http://localhost/api/cron/send-renewal-reminders", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sendReminderForCandidate sends the email and stamps renewalReminderSentForDeadline, deduping the next call", async () => {
    const clinic = await createClinic({
      name: `${TEST_PREFIX}_${seededClinicIds.length}`,
      subscriptionStatus: "trialing",
      trialEndsAt: Date.now() + 3 * DAY_MS,
    });
    seededClinicIds.push(clinic.id);
    const now = Date.now();
    const deadline = now + 3 * DAY_MS;

    await sendReminderForCandidate(
      { id: clinic.id, name: clinic.name, deadline, isTrial: true },
      "owner@example.com",
      "http://localhost:3000",
      now
    );

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: "owner@example.com" });

    const updated = await prisma.clinic.findUnique({ where: { id: clinic.id } });
    expect(Number(updated?.renewalReminderSentForDeadline)).toBe(deadline);

    // Re-running buildReminderCandidates against this clinic's now-updated
    // row must exclude it — the real dedupe path GET actually relies on.
    const { buildReminderCandidates } = await import("./route");
    const stillCandidate = buildReminderCandidates(
      [
        {
          id: clinic.id,
          name: clinic.name,
          subscriptionStatus: "trialing",
          trialEndsAt: BigInt(now + 3 * DAY_MS),
          subscriptionRenewsAt: null,
          renewalReminderSentForDeadline: updated!.renewalReminderSentForDeadline,
        },
      ],
      now
    );
    expect(stillCandidate).toHaveLength(0);
  });
});
