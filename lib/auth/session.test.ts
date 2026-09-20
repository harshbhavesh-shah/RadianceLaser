import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSignedSessionToken, verifySignedSessionToken } from "./session";

const ORIGINAL_SECRET = process.env.AUTH_SESSION_SECRET;

beforeEach(() => {
  process.env.AUTH_SESSION_SECRET = "test-session-secret";
});

afterEach(() => {
  process.env.AUTH_SESSION_SECRET = ORIGINAL_SECRET;
});

describe("createSignedSessionToken / verifySignedSessionToken", () => {
  it("round-trips a clinic staff session", async () => {
    const token = await createSignedSessionToken(
      { uid: "staff_1", email: "owner@example.com", clinicId: "clinic_1", role: "owner", superAdmin: false },
      1000 * 60 * 60
    );
    const payload = await verifySignedSessionToken(token);
    expect(payload).toMatchObject({
      uid: "staff_1",
      email: "owner@example.com",
      clinicId: "clinic_1",
      role: "owner",
      superAdmin: false,
    });
  });

  it("round-trips a pure super-admin session with no clinic", async () => {
    const token = await createSignedSessionToken(
      { uid: "admin_1", email: "admin@example.com", clinicId: null, role: null, superAdmin: true },
      1000 * 60 * 60
    );
    const payload = await verifySignedSessionToken(token);
    expect(payload).toMatchObject({ uid: "admin_1", clinicId: null, role: null, superAdmin: true });
  });

  it("rejects an expired token", async () => {
    const token = await createSignedSessionToken(
      { uid: "staff_1", email: null, clinicId: "clinic_1", role: "owner", superAdmin: false },
      -1000
    );
    expect(await verifySignedSessionToken(token)).toBeNull();
  });

  it("rejects a token signed under a different secret", async () => {
    const token = await createSignedSessionToken(
      { uid: "staff_1", email: null, clinicId: "clinic_1", role: "owner", superAdmin: false },
      1000 * 60
    );
    process.env.AUTH_SESSION_SECRET = "a-different-secret";
    expect(await verifySignedSessionToken(token)).toBeNull();
  });

  it("rejects garbage input", async () => {
    expect(await verifySignedSessionToken("not-a-real-token")).toBeNull();
    expect(await verifySignedSessionToken("")).toBeNull();
  });
});
