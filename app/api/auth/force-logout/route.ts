import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";

/**
 * Clears a stale/invalid session cookie before sending the browser to
 * /login — every getSession()/getAdminSession() failure across the app
 * (see lib/session.ts) redirects here instead of straight to "/login".
 *
 * Why this exists: middleware.ts can only check that a session cookie is
 * *present*, not that it's actually valid (the Admin SDK it'd need for
 * that doesn't run in the Edge runtime) — so it treats any request to
 * /login carrying a cookie as "already signed in" and bounces it straight
 * back to /dashboard or /admin. If a page's real, verified session check
 * then fails (an expired cookie, or an account that got deleted/revoked
 * while still "logged in" on some device) and redirects straight to
 * "/login" without clearing the cookie, middleware sees that same stale
 * cookie on the very next request and bounces it away from /login again —
 * an infinite redirect loop with no way out except manually clearing
 * cookies in the browser. Routing through here first breaks that: a Route
 * Handler (unlike a Server Component's redirect()) is allowed to mutate
 * cookies, so by the time the browser lands on /login, the cookie is
 * actually gone and middleware lets it through normally.
 */
export async function GET(request: NextRequest) {
  clearSessionCookie();
  return NextResponse.redirect(new URL("/login", request.url));
}
