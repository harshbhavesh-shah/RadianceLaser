import "server-only";
import { cookies } from "next/headers";
import { createSignedSessionToken, verifySignedSessionToken } from "@/lib/auth/session";
import type { AdminSession, Session, UserRole } from "@/types";

const SESSION_COOKIE_NAME = "__session";
// Was capped at 5 days back when Firebase session cookies could live up to
// 14 — no longer a hard ceiling now that we mint these ourselves, but kept
// the same for a clinical/admin tool where staff share shared devices at a
// front desk.
const SESSION_EXPIRES_IN_MS = 1000 * 60 * 60 * 24 * 5; // 5 days

// A super admin's "View as" state (app/admin/actions.ts
// startImpersonationAction) — deliberately a separate, plain (not a signed
// token) cookie, since it's only ever trusted in combination with an
// independently-verified super-admin session on the real __session cookie
// below (see getSession()). Short-lived on purpose: this is a one-off
// support session, not a standing login.
const IMPERSONATE_COOKIE_NAME = "__impersonate";
const IMPERSONATE_MAX_AGE_S = 60 * 60 * 2; // 2 hours

interface ImpersonationPayload {
  clinicId: string;
  clinicName: string;
  role: UserRole;
}

export interface SessionSubject {
  uid: string;
  email: string | null;
  // null for a pure super-admin with no clinic (see PlatformAdmin in
  // prisma/schema.prisma) — a clinic staff member who also happens to be a
  // super admin still has a real clinicId/role here, with superAdmin=true.
  clinicId: string | null;
  role: UserRole | null;
  superAdmin: boolean;
}

/**
 * Mints a session cookie for an already-authenticated subject — call this
 * right after a password check (app/login/actions.ts) or, temporarily, a
 * verified Google ID token (see the Google sign-in bridge there) succeeds.
 * Purely local: signs a token with AUTH_SESSION_SECRET, no network round
 * trip anywhere — unlike the old Firebase Admin createSessionCookie, which
 * called out to Google to mint it.
 */
export async function createSessionCookieForSubject(subject: SessionSubject): Promise<void> {
  const token = await createSignedSessionToken(subject, SESSION_EXPIRES_IN_MS);

  cookies().set(SESSION_COOKIE_NAME, token, {
    maxAge: SESSION_EXPIRES_IN_MS / 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
  });
}

export function clearSessionCookie(): void {
  cookies().delete(SESSION_COOKIE_NAME);
}

/** Starts a "View as" support session — see app/admin/actions.ts
 * startImpersonationAction, the only caller. */
export function startImpersonation(payload: ImpersonationPayload): void {
  cookies().set(IMPERSONATE_COOKIE_NAME, JSON.stringify(payload), {
    maxAge: IMPERSONATE_MAX_AGE_S,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    sameSite: "lax",
  });
}

/** Reads the current impersonation payload without clearing it — used by
 * stopImpersonationAction to know which clinic to log as "stopped viewing
 * as" before it clears the cookie. */
export function peekImpersonation(): ImpersonationPayload | null {
  const raw = cookies().get(IMPERSONATE_COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ImpersonationPayload;
  } catch {
    return null;
  }
}

export function stopImpersonation(): void {
  cookies().delete(IMPERSONATE_COOKIE_NAME);
}

/**
 * Reads and verifies the session cookie server-side. Returns null if
 * there's no cookie, it's expired/tampered, or it's missing a
 * clinicId/role (which means the account wasn't provisioned correctly).
 * Use this in server components and server actions to gate access.
 *
 * Unlike the old Firebase-backed version, a disabled account's
 * already-issued session cookie is NOT force-invalidated the instant
 * disabled flips true — checking that here would mean a Postgres read on
 * every single authenticated request just to catch a rare, non-urgent
 * case (an owner disabling a staff account). Same tradeoff this file
 * already made for Firebase's checkRevoked (measured at ~245ms/request):
 * disabling only takes effect the next time that person tries to sign in
 * again, not mid-session. verifySignedSessionToken itself is pure
 * signature+expiry verification — no network, no DB.
 */
export async function getSession(): Promise<Session | null> {
  // A present impersonation cookie always short-circuits to either an
  // impersonated session or null — never falls through to a normal
  // session check, since that could use mismatched real session state (or
  // none at all) alongside a stray/forged impersonation cookie.
  const impersonation = peekImpersonation();
  if (impersonation) {
    // Only trust the cookie's clinicId if this request ALSO carries a
    // genuinely verified super-admin session — otherwise anyone could set
    // this cookie themselves and grant themselves access to any clinic.
    const adminSession = await getAdminSession();
    if (!adminSession) return null;

    return {
      uid: adminSession.uid,
      email: adminSession.email,
      clinicId: impersonation.clinicId,
      role: impersonation.role,
      isSuperAdmin: true,
      impersonating: { clinicName: impersonation.clinicName },
    };
  }

  const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  const payload = await verifySignedSessionToken(sessionCookie);
  if (!payload || !payload.clinicId || !payload.role) return null;

  return {
    uid: payload.uid,
    email: payload.email,
    clinicId: payload.clinicId,
    role: payload.role,
    isSuperAdmin: payload.superAdmin,
  };
}

/**
 * Reads and verifies the session cookie for the platform-level admin panel
 * (app/admin) — separate from getSession() above because a super-admin
 * isn't scoped to a clinicId/role at all; requiring those here would lock
 * out a pure platform-admin account that never had a clinic. This is the
 * actual security boundary for every app/admin page and server action, the
 * same way getSession() is for /dashboard — always re-check this inside
 * server actions too, not just page-level layouts, since actions can be
 * invoked directly.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  const payload = await verifySignedSessionToken(sessionCookie);
  if (!payload || payload.superAdmin !== true) return null;

  return { uid: payload.uid, email: payload.email };
}

export { SESSION_COOKIE_NAME };
