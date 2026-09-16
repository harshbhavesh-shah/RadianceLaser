import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { createClinic } from "@/lib/db/clinics";
import { GET } from "./route";
import { findExpiredTrialClinicIds, expireTrialClinic } from "./logic";

// Deliberately does not call GET against seeded-plus-real data the way the
// original send-scheduled-messages test mistakenly did (see that file's
// comment) — findExpiredTrialClinicIds is read-only so it's safe to call
// for real, but assertions only check membership of this test's own
// clinics, never the full list, and expireTrialClinic is always called
// with one specific id this test seeded itself.

const TEST_PREFIX = `_test_expire_trials_${Date.now()}`;
const seededClinicIds: string[] = [];

async function seedClinic(trialEndsAt: number): Promise<string> {
  const clinic = await createClinic({
    name: `${TEST_PREFIX}_${seededClinicIds.length}`,
    subscriptionStatus: "trialing",
    trialEndsAt,
  });
  seededClinicIds.push(clinic.id);
  return clinic.id;
}

describe("expire-trials cron (integration, real Postgres)", () => {
  beforeAll(async () => {
    const stale = await prisma.clinic.findMany({ where: { name: { startsWith: "_test_expire_trials_" } }, select: { id: true } });
    if (stale.length) await prisma.clinic.deleteMany({ where: { id: { in: stale.map((c) => c.id) } } });
  });

  afterAll(async () => {
    await prisma.clinic.deleteMany({ where: { id: { in: seededClinicIds } } });
  });

  it("GET rejects a request without the right bearer token", async () => {
    const req = new NextRequest("http://localhost/api/cron/expire-trials", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("finds a trialing clinic whose trialEndsAt has passed", async () => {
    const clinicId = await seedClinic(Date.now() - 1000 * 60 * 60); // expired an hour ago
    const now = Date.now();
    const expiredIds = await findExpiredTrialClinicIds(now);
    expect(expiredIds).toContain(clinicId);
  });

  it("does not find a trialing clinic whose trial hasn't ended yet", async () => {
    const clinicId = await seedClinic(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30 days out
    const now = Date.now();
    const expiredIds = await findExpiredTrialClinicIds(now);
    expect(expiredIds).not.toContain(clinicId);
  });

  it("expireTrialClinic settles the clinic onto the free tier, never locking a fresh signup", async () => {
    const clinicId = await seedClinic(Date.now() - 1000 * 60 * 60);
    await expireTrialClinic(clinicId);

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    expect(clinic?.subscriptionStatus).toBe("active");
    expect(clinic?.planTier).toBe("free");
    expect(clinic?.subscriptionRenewsAt).toBeNull();
  });

  it("leaves an active (paying) clinic's subscriptionRenewsAt untouched — this cron never re-processes it", async () => {
    const clinic = await createClinic({
      name: `${TEST_PREFIX}_${seededClinicIds.length}`,
      subscriptionStatus: "trialing",
      trialEndsAt: Date.now() - 1000 * 60 * 60,
    });
    seededClinicIds.push(clinic.id);
    const renewsAt = Date.now() + 1000 * 60 * 60 * 24 * 200;
    await prisma.clinic.update({
      where: { id: clinic.id },
      data: { subscriptionStatus: "active", subscriptionRenewsAt: BigInt(renewsAt) },
    });

    // An "active" clinic is never a candidate regardless of trialEndsAt —
    // findExpiredTrialClinicIds only ever selects subscriptionStatus "trialing".
    const expiredIds = await findExpiredTrialClinicIds(Date.now());
    expect(expiredIds).not.toContain(clinic.id);

    const unchanged = await prisma.clinic.findUnique({ where: { id: clinic.id } });
    expect(Number(unchanged?.subscriptionRenewsAt)).toBe(renewsAt);
  });
});
