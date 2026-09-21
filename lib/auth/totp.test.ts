import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.AUTH_SESSION_SECRET = "test-secret";

import { verifyTotp, generateTotpSecret, encryptTotpSecret, decryptTotpSecret } from "./totp";

describe("totp", () => {
  it("matches the RFC 6238 SHA-1 test vector", () => {
    // Secret "12345678901234567890" at T=59s -> 94287082 (8 digits); last 6 = 287082.
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    vi.useFakeTimers();
    vi.setSystemTime(59_000);
    expect(verifyTotp(secret, "287082")).toBe(1);
    expect(verifyTotp(secret, "287082", 1)).toBeNull(); // replay rejected
    expect(verifyTotp(secret, "000000")).toBeNull();
    vi.useRealTimers();
  });

  it("round-trips encrypted secrets and rejects tampering", () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    const enc = encryptTotpSecret(s);
    expect(decryptTotpSecret(enc)).toBe(s);
    expect(decryptTotpSecret(enc.slice(0, -2) + "AA")).toBeNull();
  });
});
