import { NextResponse, type NextRequest } from "next/server";
import { verifySignedSessionToken } from "@/lib/auth/session";

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

// The session cookie is a self-rolled signed token (lib/auth/signedToken.ts,
// HMAC over Web Crypto), not a Firebase JWT — unlike the old Firebase Admin
// SDK, verifySignedSessionToken runs fine in the Edge runtime, so this
// middleware does the SAME real signature+expiry check getSession()/
// getAdminSession() do downstream, not just a presence check. It's kept
// here in addition to (not instead of) those, since server actions can be
// invoked directly and must never trust middleware alone — but the "cookie
// present but not actually valid" gap this used to have is closed.
const SESSION_COOKIE_NAME = "__session";

export async function middleware(request: NextRequest) {
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
  const payload = sessionCookie ? await verifySignedSessionToken(sessionCookie) : null;
  const hasValidSession = Boolean(payload);

  // /admin (the platform super-admin panel) is only routed here on a valid
  // session — app/admin/layout.tsx's getAdminSession() still separately
  // checks the superAdmin flag itself, since this middleware doesn't (a
  // regular clinic staff session is "valid" too, just not an admin one).
  const isProtectedRoute = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
  // /signup gets the same "already signed in? go to your dashboard instead"
  // treatment as /login — a signed-in visitor has no reason to see a form
  // for creating a brand new clinic.
  const isLoginRoute = pathname === "/login" || pathname === "/signup";

  if (isProtectedRoute && !hasValidSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginRoute && hasValidSession) {
    const destination = payload?.superAdmin && !payload?.clinicId ? "/admin" : "/dashboard";
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
