import { describe, it, expect } from "vitest";
import { signToken, verifyToken } from "./signedToken";

const SECRET = "test-secret-do-not-use-in-real-env";

describe("signToken / verifyToken", () => {
  it("round-trips a payload signed and verified with the same secret", async () => {
    const token = await signToken({ uid: "abc123", role: "owner" }, SECRET);
    const payload = await verifyToken<{ uid: string; role: string }>(token, SECRET);
    expect(payload).toEqual({ uid: "abc123", role: "owner" });
  });

  it("rejects a token verified with the wrong secret", async () => {
    const token = await signToken({ uid: "abc123" }, SECRET);
    expect(await verifyToken(token, "a-different-secret")).toBeNull();
  });

  it("rejects a tampered payload", async () => {
    const token = await signToken({ uid: "abc123", role: "staff" }, SECRET);
    const [payloadB64, signatureB64] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ uid: "abc123", role: "owner" }))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(await verifyToken(`${tamperedPayload}.${signatureB64}`, SECRET)).toBeNull();
    expect(payloadB64).not.toBe(tamperedPayload);
  });

  it("rejects malformed tokens", async () => {
    expect(await verifyToken("not-a-token-at-all", SECRET)).toBeNull();
    expect(await verifyToken("", SECRET)).toBeNull();
    expect(await verifyToken(".", SECRET)).toBeNull();
  });
});
