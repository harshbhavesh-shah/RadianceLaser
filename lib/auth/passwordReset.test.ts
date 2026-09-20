import { describe, it, expect, vi, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";

const sendEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email/resend", () => ({ sendEmail: (...args: unknown[]) => sendEmailMock(...args) }));

const { issuePasswordResetToken, verifyPasswordResetToken, consumePasswordResetToken } = await import("./passwordReset");
const { verifyPassword } = await import("./password");

const TEST_CLINIC_PREFIX = `_test_pwreset_clinic_${Date.now()}`;
const createdClinicIds: string[] = [];

function extractToken(html: string): string {
  const match = html.match(/token=([a-f0-9]+)/);
  if (!match) throw new Error("No token found in reset email HTML");
  return match[1];
}

async function makeTestStaff(email: string) {
  const clinicId = `${TEST_CLINIC_PREFIX}_${createdClinicIds.length}`;
  const clinic = await prisma.clinic.create({
    data: {
      id: clinicId,
      slug: clinicId,
      name: "Password Reset Test Clinic",
      subscriptionStatus: "trialing",
      trialEndsAt: 0,
      createdAt: Date.now(),
    },
  });
  createdClinicIds.push(clinic.id);
  return prisma.staffMember.create({
    data: { clinicId: clinic.id, name: "Test Owner", email, role: "owner", passwordHash: null, createdAt: Date.now() },
  });
}

afterAll(async () => {
  await prisma.staffMember.deleteMany({ where: { clinicId: { in: createdClinicIds } } });
  await prisma.clinic.deleteMany({ where: { id: { in: createdClinicIds } } });
});

describe("password reset (integration, real Postgres)", () => {
  it("round-trips: issue, verify, consume, and the new password actually verifies", async () => {
    const email = `_test_pwreset_${Date.now()}@example.com`;
    const staff = await makeTestStaff(email);

    await issuePasswordResetToken(staff.id, email);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: email, subject: expect.stringContaining("Reset") })
    );
    const token = extractToken(sendEmailMock.mock.calls.at(-1)![0].html);

    const verified = await verifyPasswordResetToken(token);
    expect(verified).toEqual({ uid: staff.id });

    const result = await consumePasswordResetToken(token, "BrandNewPassword2026!");
    expect(result).toEqual({ success: true });

    const updated = await prisma.staffMember.findUnique({ where: { id: staff.id } });
    expect(await verifyPassword("BrandNewPassword2026!", updated!.passwordHash)).toBe(true);

    await prisma.passwordResetToken.deleteMany({ where: { uid: staff.id } });
  });

  it("rejects reusing an already-consumed token", async () => {
    const email = `_test_pwreset_reuse_${Date.now()}@example.com`;
    const staff = await makeTestStaff(email);

    await issuePasswordResetToken(staff.id, email);
    const token = extractToken(sendEmailMock.mock.calls.at(-1)![0].html);

    await consumePasswordResetToken(token, "FirstPassword2026!");
    const secondAttempt = await consumePasswordResetToken(token, "SecondPassword2026!");
    expect(secondAttempt).toEqual({ error: "used" });

    await prisma.passwordResetToken.deleteMany({ where: { uid: staff.id } });
  });

  it("rejects a garbage token", async () => {
    expect(await verifyPasswordResetToken("not-a-real-token")).toEqual({ error: "invalid" });
  });

  it("rejects an expired token", async () => {
    const email = `_test_pwreset_expired_${Date.now()}@example.com`;
    const staff = await makeTestStaff(email);

    await issuePasswordResetToken(staff.id, email);
    const token = extractToken(sendEmailMock.mock.calls.at(-1)![0].html);
    const crypto = await import("crypto");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await prisma.passwordResetToken.update({ where: { tokenHash }, data: { expiresAt: BigInt(Date.now() - 1000) } });

    expect(await verifyPasswordResetToken(token)).toEqual({ error: "expired" });

    await prisma.passwordResetToken.deleteMany({ where: { uid: staff.id } });
  });
});
