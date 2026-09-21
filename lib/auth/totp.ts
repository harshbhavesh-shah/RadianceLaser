import "server-only";
import crypto from "crypto";
import QRCode from "qrcode";
import { getAuthSecret } from "@/lib/auth/session";

// RFC 6238 TOTP (SHA-1, 6 digits, 30s) — the parameters every authenticator
// app (Google Authenticator, Authy, 1Password, Microsoft Authenticator…)
// supports. Self-implemented on Node's crypto rather than a library: it's
// ~30 lines and this app already hand-rolls its other auth primitives.
const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1; // accept the previous/next step too, for clock drift
const ISSUER = "Radiance Laser";
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of str.replace(/=+$/, "").toUpperCase()) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** A fresh 160-bit secret, base32 — what the user's app stores. */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

/** Returns the matched time step (for replay protection — the caller stores
 * it and rejects any step <= the last accepted one) or null if the code is
 * wrong. Constant-time comparison per candidate. */
export function verifyTotp(secret: string, code: string, lastUsedStep?: number | null): number | null {
  const trimmed = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(trimmed)) return null;
  const now = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  let matched: number | null = null;
  for (let step = now - WINDOW; step <= now + WINDOW; step++) {
    const expected = Buffer.from(hotp(secret, step));
    if (crypto.timingSafeEqual(expected, Buffer.from(trimmed)) && matched === null) matched = step;
  }
  if (matched === null) return null;
  if (lastUsedStep != null && matched <= lastUsedStep) return null;
  return matched;
}

/** SVG data URI QR code for the otpauth:// enrolment URL. */
export async function totpQrDataUri(secret: string, accountEmail: string): Promise<string> {
  const label = encodeURIComponent(`${ISSUER}:${accountEmail}`);
  const url = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: 176 });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// The secret is stored encrypted (AES-256-GCM, key derived from
// AUTH_SESSION_SECRET) so a database leak alone doesn't hand out everyone's
// authenticator seeds. Note: rotating AUTH_SESSION_SECRET therefore also
// invalidates enrolled authenticators.
function encryptionKey(): Buffer {
  return crypto.createHash("sha256").update(`totp-secret:${getAuthSecret()}`).digest();
}

export function encryptTotpSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decryptTotpSecret(stored: string): string | null {
  try {
    const [iv, tag, enc] = stored.split(".").map((p) => Buffer.from(p, "base64"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
