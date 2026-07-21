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

export function middleware(request: NextRequest) {
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  const { pathname } = request.nextUrl;

  const isProtectedRoute = pathname.startsWith("/dashboard");
  const isLoginRoute = pathname === "/login";

  if (isProtectedRoute && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginRoute && hasSessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
