import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/resend";
import { hashPassword } from "@/lib/auth/password";

// Same shape as lib/twoFactor.ts's email-OTP challenge, but a long random
// token in a URL instead of a short code someone types in — the token
// itself (not an attempt limit) is the whole defense against guessing,
// since it travels in a link, not typed by hand.
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour — matches what the UI already told people under Firebase

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function resetEmailHtml(url: string): string {
  return `
    <div style="background:#FBF8F3;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
      <div style="max-width:420px;margin:0 auto;background:#FFFFFF;border:1px solid #E8DDC9;border-radius:12px;padding:32px;">
        <div style="font-size:22px;font-weight:bold;color:#2C1D14;">Radiance Laser</div>
        <div style="height:2px;width:32px;background:#A9812F;margin:12px 0 24px;"></div>
        <p style="font-family:Arial,sans-serif;font-size:14px;color:#4A342A;margin:0 0 20px;">
          Someone requested a password reset for this account. Click below to set a new password:
        </p>
        <a href="${url}" style="display:inline-block;background:#2C1D14;color:#F3E7CC;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:12px 24px;border-radius:8px;">
          Reset your password
        </a>
        <p style="font-family:Arial,sans-serif;font-size:13px;color:#9C8672;margin:20px 0 0;">
          This link expires in an hour. If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;
}

/** Generates a token, stores its hash, and emails a reset link. `uid` may be
 * a StaffMember or PlatformAdmin id — consumePasswordResetToken figures out
 * which at the point it's actually used, so issuing one doesn't need to
 * care which kind of account this is. Any existing pending tokens for this
 * uid are left alone (unlike lib/twoFactor.ts's upsert-one-at-a-time
 * challenge) — nothing stops someone from having requested a reset twice
 * and clicking either email. */
export async function issuePasswordResetToken(uid: string, email: string): Promise<void> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      uid,
      tokenHash: hashToken(token),
      expiresAt: BigInt(Date.now() + TOKEN_TTL_MS),
      createdAt: BigInt(Date.now()),
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://radiancelaser.in";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  await sendEmail({ to: email, subject: "Reset your Radiance Laser password", html: resetEmailHtml(resetUrl) });
}

export type PasswordResetTokenError = "invalid" | "expired" | "used";

/** Checked as soon as /reset-password loads (before showing the "set a new
 * password" form) — doesn't consume the token, just reports whether it's
 * still good. */
export async function verifyPasswordResetToken(
  token: string
): Promise<{ uid: string } | { error: PasswordResetTokenError }> {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record) return { error: "invalid" };
  if (record.usedAt) return { error: "used" };
  if (Date.now() > Number(record.expiresAt)) return { error: "expired" };
  return { uid: record.uid };
}

/** Verifies the token again (never trust a client-held "it was valid a
 * moment ago"), sets the new password on whichever table actually owns
 * this uid, and marks the token used so it can't be replayed. */
export async function consumePasswordResetToken(
  token: string,
  newPassword: string
): Promise<{ success: true } | { error: PasswordResetTokenError }> {
  const result = await verifyPasswordResetToken(token);
  if ("error" in result) return result;

  const passwordHash = await hashPassword(newPassword);

  const staff = await prisma.staffMember.findUnique({ where: { id: result.uid }, select: { id: true } });
  if (staff) {
    await prisma.staffMember.update({ where: { id: result.uid }, data: { passwordHash } });
  } else {
    const admin = await prisma.platformAdmin.findUnique({ where: { id: result.uid }, select: { id: true } });
    if (!admin) return { error: "invalid" };
    await prisma.platformAdmin.update({ where: { id: result.uid }, data: { passwordHash } });
  }

  await prisma.passwordResetToken.update({
    where: { tokenHash: hashToken(token) },
    data: { usedAt: BigInt(Date.now()) },
  });
  return { success: true };
}
