// Deliberately no "server-only" import here, unlike most of lib/ — this
// module is imported directly by middleware.ts, which runs in the Edge
// runtime, not a browser. It's still safe to keep out of a client bundle:
// AUTH_SESSION_SECRET is a plain (non-NEXT_PUBLIC_) env var, so Next
// already never exposes it to client code.
import { signToken, verifyToken } from "@/lib/auth/signedToken";
import type { UserRole } from "@/types";

// The decoded shape of a self-rolled session cookie — replaces the Firebase
// session cookie's decoded custom claims (see lib/session.ts). `clinicId`/
// `role` are null for a pure super-admin account, which isn't scoped to any
// clinic (mirrors AdminSession's separate, narrower shape in types/index.ts).
export interface SessionTokenPayload {
  uid: string;
  email: string | null;
  clinicId: string | null;
  role: UserRole | null;
  superAdmin: boolean;
  exp: number; // ms epoch — checked by verifySignedSessionToken, not by verifyToken itself
}

function getSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing AUTH_SESSION_SECRET in .env.local. See .env.local.example.");
  }
  return secret;
}

export async function createSignedSessionToken(
  input: Omit<SessionTokenPayload, "exp">,
  expiresInMs: number
): Promise<string> {
  return signToken({ ...input, exp: Date.now() + expiresInMs }, getSecret());
}

/** Verifies signature + expiry and shape. Returns null for anything else —
 * wrong secret, tampered payload, expired token, or a cookie that isn't
 * even in this format at all (e.g. a stale Firebase session cookie from
 * before this migration, which has a different segment count/shape). */
export async function verifySignedSessionToken(token: string): Promise<SessionTokenPayload | null> {
  const payload = await verifyToken<SessionTokenPayload>(token, getSecret());
  if (!payload) return null;
  if (typeof payload.uid !== "string" || payload.uid.length === 0) return null;
  if (typeof payload.superAdmin !== "boolean") return null;
  if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
  return payload;
}
