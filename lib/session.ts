import "server-only";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import type { Session, UserRole } from "@/types";

const SESSION_COOKIE_NAME = "__session";
// Firebase session cookies can live up to 14 days; keep it shorter for a
// clinical/admin tool where staff share shared devices at a front desk.
const SESSION_EXPIRES_IN_MS = 1000 * 60 * 60 * 24 * 5; // 5 days

/**
 * Exchanges a Firebase Auth ID token (from client-side sign-in) for a secure,
 * HttpOnly session cookie, and sets it on the response. Call this from the
 * /api/auth/session route right after the client signs in with Firebase Auth.
 */
export async function createSessionCookie(idToken: string): Promise<void> {
  const sessionCookie = await adminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_EXPIRES_IN_MS,
  });

  cookies().set(SESSION_COOKIE_NAME, sessionCookie, {
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

/**
 * Reads and verifies the session cookie server-side. Returns null if there's
 * no cookie, it's expired/invalid, or it's missing the clinicId/role custom
 * claims (which means the user account wasn't provisioned correctly — see
 * scripts/createClinic.mjs). Use this in server components and API routes
 * to gate access — NOT in middleware, since the Admin SDK doesn't run in the
 * Edge runtime middleware uses (see middleware.ts for the lightweight check
 * that happens there instead).
 */
export async function getSession(): Promise<Session | null> {
  const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);

    const clinicId = decoded.clinicId as string | undefined;
    const role = decoded.role as UserRole | undefined;

    if (!clinicId || !role) {
      // Token is valid but wasn't issued with the custom claims this app
      // relies on — treat as unauthenticated rather than guessing defaults.
      return null;
    }

    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      clinicId,
      role,
    };
  } catch {
    // Expired, revoked, or tampered cookie.
    return null;
  }
}

export { SESSION_COOKIE_NAME };
