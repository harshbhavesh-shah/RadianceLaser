import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { allocateReceiptNumber, formatReceiptNumber } from "@/lib/db/receiptNumber";

// Two clinics issuing receipts at the exact same moment must never collide
// on the same number — a duplicate receipt number is a real billing
// dispute, not a UI glitch (see README's "Known limitations"). This is an
// integration test against the real dev database on purpose: the atomic
// INSERT ... ON CONFLICT DO UPDATE ... RETURNING is the entire thing worth
// proving here, and a mocked Prisma client would only prove the mock
// behaves atomically, not Postgres.
const TEST_CLINIC_ID = `_test_receipt_number_${Date.now()}`;

describe("formatReceiptNumber", () => {
  it("pads to 6 digits with an RCPT- prefix", () => {
    expect(formatReceiptNumber(1)).toBe("RCPT-000001");
    expect(formatReceiptNumber(42)).toBe("RCPT-000042");
    expect(formatReceiptNumber(123456)).toBe("RCPT-123456");
  });

  it("doesn't truncate past 6 digits once a clinic has issued that many receipts", () => {
    expect(formatReceiptNumber(1234567)).toBe("RCPT-1234567");
  });
});

describe("allocateReceiptNumber (integration, real Postgres)", () => {
  afterAll(async () => {
    await prisma.receiptCounter.deleteMany({ where: { clinicId: { startsWith: TEST_CLINIC_ID } } });
  });

  it("allocates sequentially increasing numbers for one clinic", async () => {
    const first = await allocateReceiptNumber(TEST_CLINIC_ID);
    const second = await allocateReceiptNumber(TEST_CLINIC_ID);
    const third = await allocateReceiptNumber(TEST_CLINIC_ID);
    expect(first).toBe("RCPT-000001");
    expect(second).toBe("RCPT-000002");
    expect(third).toBe("RCPT-000003");
  });

  it("never allocates the same number twice under concurrent calls — the exact race the atomic upsert exists to prevent", async () => {
    const CONCURRENT_CALLS = 25;
    const results = await Promise.all(
      Array.from({ length: CONCURRENT_CALLS }, () => allocateReceiptNumber(TEST_CLINIC_ID))
    );
    expect(new Set(results).size).toBe(CONCURRENT_CALLS);
  });

  it("keeps each clinic's counter independent", async () => {
    const otherClinicId = `${TEST_CLINIC_ID}_other`;
    const first = await allocateReceiptNumber(otherClinicId);
    // Starts fresh at 1 — unaffected by however far the first clinic's
    // counter (already exercised by the tests above) has climbed.
    expect(first).toBe("RCPT-000001");
  });
});
