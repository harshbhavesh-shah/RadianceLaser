import { NextResponse, type NextRequest } from "next/server";

// The apex domain the main app (marketing site, login, dashboard) lives
// on — every OTHER hostname this middleware sees is treated as a clinic's
// public-booking subdomain (https://{slug}.radiancelaser.in, set up at
// clinic-creation time — see lib/clinicSlug.ts). Overridable via env for
// local development, where the real domain obviously isn't reachable;
// defaults to the production value so nothing needs setting for a normal
// deploy.
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "radiancelaser.in";

// Subdomains that must never resolve to a clinic's booking page — kept in
// sync by hand with lib/clinicSlug.ts's own copy of this list (that file
// pulls in Prisma/pg, which the Edge runtime this middleware runs on
// doesn't support, so it can't be imported here directly). A request for
// one of these is rejected outright below instead of being rewritten to
// /book/{slug}, so it fails as "this subdomain doesn't exist" rather than
// silently falling through to the booking page's generic "clinic not
// found" — indistinguishable there from any other bad slug.
const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "mail", "smtp", "ftp", "host", "dev",
  "staging", "stage", "test", "preview", "demo", "sandbox", "blog",
  "docs", "help", "support", "status", "book", "booking", "static",
  "assets", "cdn", "portal", "secure", "vpn", "shop", "store", "git",
]);

/** Strips a port (":3000") and, for the special-cased local-dev root
 * ("localhost"), leaves the hostname as-is; otherwise strips the known
 * ROOT_DOMAIN suffix to get just the subdomain label, or null if this
 * host isn't a subdomain of it at all (the apex itself, a Vercel preview
 * URL, an unrelated host hitting the server directly, etc.). */
function extractClinicSlug(hostname: string): string | null {
  const host = hostname.split(":")[0].toLowerCase();
  const root = ROOT_DOMAIN.toLowerCase();

  if (host === root || host === `www.${root}`) return null; // the main app itself

  if (host.endsWith(`.${root}`)) {
    const sub = host.slice(0, -(root.length + 1));
    // A real clinic slug is always a single label — "lumiere-aesthetique",
    // never "a.b" — so multi-level subdomains (shouldn't happen in
    // practice, but DNS doesn't stop anyone from trying) don't match.
    return sub && !sub.includes(".") ? sub : null;
  }

  return null;
}

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
  const { pathname } = request.nextUrl;

  // A clinic's own subdomain (https://{slug}.radiancelaser.in) only ever
  // serves its public booking page — rewrite straight to /book/{slug}
  // (the existing dynamic route, which already resolves a slug via
  // getClinicBySlug — see app/book/[clinicId]/page.tsx) regardless of
  // whatever path was requested, before any of the session-cookie
  // handling below even applies; a clinic's own subdomain has no
  // /dashboard, /login, etc. to protect. Static assets (_next/*,
  // favicon, etc.) still need to pass through untouched, so this only
  // rewrites when the path doesn't already look like one of those — the
  // config.matcher below narrows this further.
  const slug = extractClinicSlug(request.headers.get("host") || "");
  if (slug) {
    // A reserved word (www, dev, staging, ...) is never a real clinic —
    // reject it outright instead of rewriting to /book/{slug}, which
    // would just 404 through the booking page's normal "clinic not
    // found" path and look identical to a typo'd or made-up subdomain.
    if (RESERVED_SLUGS.has(slug)) {
      return new NextResponse("Not found", { status: 404 });
    }
    const url = request.nextUrl.clone();
    url.pathname = `/book/${slug}`;
    return NextResponse.rewrite(url);
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const hasSessionCookie = Boolean(sessionCookie);

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
  // Broadened from just the protected/login routes to (almost) everything
  // — a clinic subdomain visitor can request any path (usually just "/"),
  // not only the ones the session-cookie logic cares about, so the
  // subdomain rewrite above needs to see those requests too. Excludes
  // Next's own static/image assets and API routes, which never need
  // host-based rewriting and would just pay the middleware cost for
  // nothing.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|api/).*)"],
};
