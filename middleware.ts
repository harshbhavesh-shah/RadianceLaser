import { NextResponse, type NextRequest } from "next/server";

// IMPORTANT: middleware runs in the Edge runtime, which the Firebase Admin
// SDK does NOT support — so this can only check whether the session cookie
// is *present*, not whether it's actually valid. Full verification (checking
// signature, expiry, and the clinicId/role custom claims) happens in
// app/dashboard/layout.tsx via lib/session.ts's getSession(), which runs in
// the regular Node.js runtime. Think of this middleware check as a fast,
// cheap redirect for the common case (not logged in at all) — the real
// security boundary is the server-side check in the layout, plus Firestore
// security rules on the data itself.
const SESSION_COOKIE_NAME = "__session";

// Firebase session cookies are themselves JWTs, so their payload can be
// peeked at without verifying the signature — fine for a routing hint, NOT
// a security check (that's getSession()/getAdminSession() downstream).
// Used below so a super-admin-only account (no clinicId at all) hitting
// /login with an existing cookie gets routed to /admin instead of
// /dashboard — sending it to /dashboard would 404-loop, since
// app/dashboard/layout.tsx's getSession() returns null for an account with
// no clinicId, bouncing back to /login, which would bounce it to
// /dashboard again.
function decodeSessionClaims(cookieValue: string): { clinicId?: string; superAdmin?: boolean } | null {
  try {
    const payload = cookieValue.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const hasSessionCookie = Boolean(sessionCookie);
  const { pathname } = request.nextUrl;

  // /admin (the platform super-admin panel) gets the same cheap
  // cookie-presence check as /dashboard — the real check (does this
  // account actually carry the superAdmin claim, not just any valid
  // session) happens in app/admin/layout.tsx via getAdminSession(), for the
  // same Edge-runtime-can't-run-Admin-SDK reason described above.
  const isProtectedRoute = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
  // /signup gets the same "already signed in? go to your dashboard instead"
  // treatment as /login — a signed-in visitor has no reason to see a form
  // for creating a brand new clinic.
  const isLoginRoute = pathname === "/login" || pathname === "/signup";

  if (isProtectedRoute && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginRoute && hasSessionCookie) {
    const claims = sessionCookie ? decodeSessionClaims(sessionCookie) : null;
    const destination = claims?.superAdmin && !claims?.clinicId ? "/admin" : "/dashboard";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/signup"],
};
