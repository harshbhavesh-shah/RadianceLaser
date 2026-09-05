import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getAdminSession } from "@/lib/session";
import { buildGoogleAuthUrl } from "@/lib/gmail/oauth";

const STATE_COOKIE = "google_oauth_state";

/** Kicks off the Gmail OAuth consent flow — super-admin only, since this is
 * what connects admin@radiancelaser.in's inbox (see app/admin/email). The
 * state value is round-tripped through a short-lived cookie rather than
 * trusted from the query string alone, so the callback can confirm this
 * exact browser started the flow (a bare CSRF guard, not authentication —
 * requireSuperAdmin() in the callback is the real gate). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const redirectUri = new URL("/api/oauth/google/callback", request.url).toString();

  const response = NextResponse.redirect(buildGoogleAuthUrl(redirectUri, state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
