import "server-only";
import crypto from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import { sendEmail } from "@/lib/email/resend";

const CODE_LENGTH = 6;
const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

interface TwoFactorChallengeDoc {
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

function generateCode(): string {
  // crypto.randomInt is uniformly distributed across the range, unlike
  // Math.random()-based approaches — this is a security code, not a UI ID.
  return String(crypto.randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

// Stored as a hash, not plaintext, for the same reason passwords are —
// anyone who could read the challenge doc (e.g. a compromised service
// account, a debugging session) shouldn't be able to read the live code
// straight off it. SHA-256 is sufficient here since the code itself already
// has a large uniform keyspace (10^6) and a short TTL, unlike a
// user-chosen, long-lived password that would need a slow hash like bcrypt.
function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Generates a fresh code, stores its hash (overwriting any prior pending
 * challenge for this uid), and emails it. Called from
 * app/login/actions.ts requestTwoFactorIfEnabledAction() right after
 * primary sign-in (password or Google) succeeds, before a session cookie is
 * issued — the emailed code gates that last step, not the password check
 * itself.
 */
export async function issueTwoFactorChallenge(uid: string, email: string): Promise<void> {
  const code = generateCode();
  const doc: TwoFactorChallengeDoc = {
    codeHash: hashCode(code),
    expiresAt: Date.now() + CODE_TTL_MS,
    attempts: 0,
  };
  await adminDb().collection("twoFactorChallenges").doc(uid).set(doc);

  await sendEmail({
    to: email,
    subject: `${code} is your RadianceLaser sign-in code`,
    html: twoFactorEmailHtml(code),
  });
}

// Inline styles only, no external stylesheet or web font — email clients
// strip <style> blocks and ignore @font-face unpredictably, so this mirrors
// the app's brown/gold palette (see tailwind.config.ts) by hand rather than
// reusing any of its actual CSS. Table-free since this is simple enough
// (one card, no multi-column layout) to render consistently as plain divs
// across Gmail/Apple Mail/Outlook web without needing table-based email
// layout tricks.
function twoFactorEmailHtml(code: string): string {
  return `
    <div style="background:#FBF8F3;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
      <div style="max-width:420px;margin:0 auto;background:#FFFFFF;border:1px solid #E8DDC9;border-radius:12px;padding:32px;">
        <div style="font-size:22px;font-weight:bold;color:#2C1D14;">RadianceLaser</div>
        <div style="height:2px;width:32px;background:#A9812F;margin:12px 0 24px;"></div>
        <p style="font-family:Arial,sans-serif;font-size:14px;color:#4A342A;margin:0 0 20px;">
          Here's your sign-in code:
        </p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#2C1D14;background:#F3E7CC;border-radius:8px;padding:16px;text-align:center;">
          ${code}
        </div>
        <p style="font-family:Arial,sans-serif;font-size:13px;color:#9C8672;margin:20px 0 0;">
          This code expires in 10 minutes. If you didn't try to sign in, you can safely ignore this email.
        </p>
      </div>
    </div>
  `;
}

export type TwoFactorVerifyResult = "ok" | "invalid" | "expired" | "too-many-attempts" | "no-challenge";

/**
 * Checks a submitted code against the stored challenge. Consumes the
 * challenge (deletes it) on success, expiry, or exceeding the attempt
 * limit — a wrong guess doesn't consume it outright, just increments the
 * counter, so a genuine typo doesn't force requesting a whole new code.
 */
export async function verifyTwoFactorCode(uid: string, code: string): Promise<TwoFactorVerifyResult> {
  const ref = adminDb().collection("twoFactorChallenges").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) return "no-challenge";

  const data = snap.data() as TwoFactorChallengeDoc;

  if (Date.now() > data.expiresAt) {
    await ref.delete();
    return "expired";
  }
  if (data.attempts >= MAX_ATTEMPTS) {
    await ref.delete();
    return "too-many-attempts";
  }
  if (hashCode(code) !== data.codeHash) {
    await ref.update({ attempts: data.attempts + 1 });
    return "invalid";
  }

  await ref.delete();
  return "ok";
}
