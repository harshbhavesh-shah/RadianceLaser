import "server-only";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

/** Hashes a plaintext password for storage in StaffMember.passwordHash.
 * scrypt, not bcrypt — no extra dependency (Node's own crypto module),
 * and deliberately not the fast SHA-256 lib/twoFactor.ts uses for OTP
 * codes: a password is user-chosen and long-lived, so it needs a slow,
 * memory-hard hash to resist offline brute-forcing if the DB ever leaks. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Verifies a plaintext password against a stored hash. Always false for a
 * null/malformed hash (e.g. a pre-migration row that hasn't been reset yet)
 * rather than throwing — callers treat "no valid password" uniformly. */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, saltHex, hashHex] = parts;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;
  const derived = (await scrypt(password, salt, expected.length)) as Buffer;
  return timingSafeEqual(derived, expected);
}
