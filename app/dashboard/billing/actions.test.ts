import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { createClinic } from "@/lib/db/clinics";
import type { Session } from "@/types";

// The pure pricing math (lib/pricing.ts) is covered elsewhere; this proves
// what it feeds into — that a checkout action actually writes the Payment
// and Clinic rows a real purchase depends on, against real Postgres.
// Razorpay itself (a paid external API) and outbound email are mocked;
// everything each action does to OUR database is real. Sequential
// (fileParallelism: false, set repo-wide) so this doesn't race
// receiptNumber.test.ts's own real-DB writes.

let mockSession: Session | null = null;
vi.mock("@/lib/session", () => ({
  getSession: () => Promise.resolve(mockSession),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  // The real implementation needs Next's request-scoped incremental cache,
  // which doesn't exist outside an actual request — caching behavior isn't
  // what these tests are about, so just run the wrapped function directly.
  unstable_cache:
    <T extends (...args: unknown[]) => unknown>(fn: T) =>
    (...args: Parameters<T>) =>
      fn(...args),
}));

const razorpay = vi.hoisted(() => ({
  createOrder: vi.fn(),
  createOrGetCustomer: vi.fn(),
  createAnnualPlan: vi.fn(),
  createSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  fetchPayment: vi.fn(),
  verifyCheckoutSignature: vi.fn(),
  verifySubscriptionCheckoutSignature: vi.fn(),
}));
vi.mock("@/lib/razorpay", () => razorpay);

// Each test does several sequential real-Postgres round trips (seed a
// clinic, create an order/subscription, confirm it, assert the resulting
// rows) — the default 5s test / 10s hook timeouts are tuned for
// pure-logic tests, not this, and were flaking under normal load (a
// different test/hook timing out each run, never an actual assertion
// failure) — same fix already applied to the cron suites' own real-DB
// tests.
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

const {
  createRenewalOrderAction,
  verifyPaymentAction,
  createAutoRenewSubscriptionAction,
  verifySubscriptionAction,
  cancelAutoRenewAction,
} = await import("./actions");

const TEST_CLINIC_PREFIX = `_test_billing_${Date.now()}`;
let clinicCounter = 0;
const seededClinicIds: string[] = [];

async function seedOwnerClinic(): Promise<string> {
  const clinic = await createClinic({
    name: `${TEST_CLINIC_PREFIX}_${clinicCounter++}`,
    subscriptionStatus: "trialing",
    trialEndsAt: Date.now() + 1000 * 60 * 60 * 24 * 30,
  });
  seededClinicIds.push(clinic.id);
  mockSession = {
    uid: "_test_owner_uid",
    clinicId: clinic.id,
    role: "owner",
    email: "owner@example.com",
    isSuperAdmin: false,
  };
  return clinic.id;
}

describe("billing actions (integration, real Postgres; Razorpay mocked)", () => {
  beforeAll(async () => {
    // Belt-and-suspenders against a prior run that crashed before its own
    // afterAll ran (e.g. mid-development, this exact suite left orphaned
    // rows behind when its cleanup query itself had a bug) — those rows
    // would otherwise collide with this run's hardcoded Razorpay order/
    // subscription ids across unrelated clinics.
    const stale = await prisma.clinic.findMany({
      where: { name: { startsWith: "_test_billing_" } },
      select: { id: true },
    });
    if (stale.length) {
      const staleIds = stale.map((c) => c.id);
      await prisma.payment.deleteMany({ where: { clinicId: { in: staleIds } } });
      await prisma.clinic.deleteMany({ where: { id: { in: staleIds } } });
    }
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { clinicId: { in: seededClinicIds } } });
    await prisma.clinic.deleteMany({ where: { id: { in: seededClinicIds } } });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createRenewalOrderAction", () => {
    it("rejects a non-owner without ever calling Razorpay", async () => {
      await seedOwnerClinic();
      mockSession = { ...mockSession!, role: "reception" };
      const result = await createRenewalOrderAction("pro");
      expect(result.error).toBeTruthy();
      expect(razorpay.createOrder).not.toHaveBeenCalled();
    });

    it("rejects an out-of-range enterprise center count without calling Razorpay", async () => {
      await seedOwnerClinic();
      const result = await createRenewalOrderAction("enterprise", 99);
      expect(result.error).toMatch(/between/i);
      expect(razorpay.createOrder).not.toHaveBeenCalled();
    });

    it("opens a real Razorpay order and writes a matching pending Payment row", async () => {
      const clinicId = await seedOwnerClinic();
      razorpay.createOrder.mockResolvedValue({ id: "order_test_123" });

      const result = await createRenewalOrderAction("pro");
      expect(result.error).toBeUndefined();
      expect(result.order?.orderId).toBe("order_test_123");
      expect(razorpay.createOrder).toHaveBeenCalledTimes(1);

      const payment = await prisma.payment.findFirst({ where: { razorpayOrderId: "order_test_123" } });
      expect(payment).toMatchObject({
        clinicId,
        status: "created",
        planTier: "pro",
        amount: result.order?.amount,
      });
    });
  });

  describe("verifyPaymentAction", () => {
    it("refuses a payment whose signature doesn't check out, and writes nothing", async () => {
      const clinicId = await seedOwnerClinic();
      razorpay.createOrder.mockResolvedValue({ id: "order_test_bad_sig" });
      await createRenewalOrderAction("basic");
      razorpay.verifyCheckoutSignature.mockReturnValue(false);

      const result = await verifyPaymentAction({
        orderId: "order_test_bad_sig",
        paymentId: "pay_x",
        signature: "forged",
      });
      expect(result.error).toBeDefined();

      const payment = await prisma.payment.findFirst({ where: { razorpayOrderId: "order_test_bad_sig" } });
      expect(payment?.status).toBe("created");

      const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
      expect(clinic?.subscriptionStatus).toBe("trialing");
    });

    it("marks the payment paid and extends the clinic's real subscription window", async () => {
      const clinicId = await seedOwnerClinic();
      razorpay.createOrder.mockResolvedValue({ id: "order_test_good" });
      await createRenewalOrderAction("standard");
      razorpay.verifyCheckoutSignature.mockReturnValue(true);

      const before = Date.now();
      const result = await verifyPaymentAction({
        orderId: "order_test_good",
        paymentId: "pay_good",
        signature: "valid",
      });
      expect(result.success).toBe(true);

      const payment = await prisma.payment.findFirst({ where: { razorpayOrderId: "order_test_good" } });
      expect(payment?.status).toBe("paid");
      expect(payment?.razorpayPaymentId).toBe("pay_good");

      const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
      expect(clinic?.subscriptionStatus).toBe("active");
      expect(clinic?.planTier).toBe("standard");
      expect(Number(clinic?.subscriptionRenewsAt)).toBeGreaterThan(before);
    });

    it("is idempotent — confirming the same order twice only pays it once", async () => {
      await seedOwnerClinic();
      razorpay.createOrder.mockResolvedValue({ id: "order_test_twice" });
      await createRenewalOrderAction("basic");
      razorpay.verifyCheckoutSignature.mockReturnValue(true);

      await verifyPaymentAction({ orderId: "order_test_twice", paymentId: "pay_1", signature: "valid" });
      const second = await verifyPaymentAction({ orderId: "order_test_twice", paymentId: "pay_2", signature: "valid" });
      expect(second.success).toBe(true);

      const payment = await prisma.payment.findFirst({ where: { razorpayOrderId: "order_test_twice" } });
      // The first confirmation won — a second payment id never overwrites it.
      expect(payment?.razorpayPaymentId).toBe("pay_1");
    });
  });

  describe("auto-renew subscription flow", () => {
    it("creates a subscription, then confirming it enables auto-renew and records one Payment", async () => {
      const clinicId = await seedOwnerClinic();
      razorpay.createOrGetCustomer.mockResolvedValue({ id: "cust_1" });
      razorpay.createAnnualPlan.mockResolvedValue({ id: "plan_1" });
      razorpay.createSubscription.mockResolvedValue({ id: "sub_1", status: "created" });

      const created = await createAutoRenewSubscriptionAction("pro");
      expect(created.subscription?.subscriptionId).toBe("sub_1");

      const afterCreate = await prisma.clinic.findUnique({ where: { id: clinicId } });
      expect(afterCreate?.razorpaySubscriptionId).toBe("sub_1");
      expect(afterCreate?.autoRenewEnabled).toBe(false); // not yet confirmed

      razorpay.verifySubscriptionCheckoutSignature.mockReturnValue(true);
      razorpay.fetchPayment.mockResolvedValue({ order_id: "order_from_sub", amount: 3000000, currency: "INR" });

      const verified = await verifySubscriptionAction({
        subscriptionId: "sub_1",
        paymentId: "pay_sub_1",
        signature: "valid",
      });
      expect(verified.success).toBe(true);

      const afterVerify = await prisma.clinic.findUnique({ where: { id: clinicId } });
      expect(afterVerify?.autoRenewEnabled).toBe(true);
      expect(afterVerify?.razorpaySubscriptionStatus).toBe("active");

      const payments = await prisma.payment.findMany({ where: { razorpaySubscriptionId: "sub_1" } });
      expect(payments).toHaveLength(1);
      expect(payments[0].razorpayPaymentId).toBe("pay_sub_1");
    });

    it("rejects confirming a subscription id that isn't this clinic's", async () => {
      await seedOwnerClinic();
      razorpay.createOrGetCustomer.mockResolvedValue({ id: "cust_2" });
      razorpay.createAnnualPlan.mockResolvedValue({ id: "plan_2" });
      razorpay.createSubscription.mockResolvedValue({ id: "sub_2", status: "created" });
      await createAutoRenewSubscriptionAction("basic");

      const result = await verifySubscriptionAction({
        subscriptionId: "sub_does_not_belong",
        paymentId: "pay_x",
        signature: "valid",
      });
      expect(result.error).toMatch(/doesn't belong/i);
    });

    it("cancelAutoRenewAction turns it back off at Razorpay and in our own record", async () => {
      const clinicId = await seedOwnerClinic();
      razorpay.createOrGetCustomer.mockResolvedValue({ id: "cust_3" });
      razorpay.createAnnualPlan.mockResolvedValue({ id: "plan_3" });
      razorpay.createSubscription.mockResolvedValue({ id: "sub_3", status: "created" });
      await createAutoRenewSubscriptionAction("basic");
      razorpay.verifySubscriptionCheckoutSignature.mockReturnValue(true);
      razorpay.fetchPayment.mockResolvedValue({ order_id: "order_3", amount: 1000000, currency: "INR" });
      await verifySubscriptionAction({ subscriptionId: "sub_3", paymentId: "pay_3", signature: "valid" });

      const result = await cancelAutoRenewAction();
      expect(result.success).toBe(true);
      expect(razorpay.cancelSubscription).toHaveBeenCalledWith("sub_3");

      const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
      expect(clinic?.autoRenewEnabled).toBe(false);
      expect(clinic?.razorpaySubscriptionStatus).toBe("cancelled");
    });

    it("cancelAutoRenewAction errors cleanly when auto-renew was never on", async () => {
      await seedOwnerClinic();
      const result = await cancelAutoRenewAction();
      expect(result.error).toMatch(/isn't currently on/i);
      expect(razorpay.cancelSubscription).not.toHaveBeenCalled();
    });
  });
});
