import "server-only";
import { prisma } from "@/lib/db/client";

// Subdomains that must never resolve to a clinic's booking page, even if a
// clinic's name would naturally slugify to one of these — either because
// they're reserved for real infrastructure (the bare apex has no
// subdomain, but these are the ones most likely to get used for one
// someday) or because they'd be confusing/spoofable as official. Also
// enforced at request time, not just clinic-creation time — see
// middleware.ts, which rejects a request for one of these outright
// instead of trying to look up a clinic by it. Kept in sync with that
// file's own copy of this list by hand (middleware runs on the Edge
// runtime, which can't import this file — it pulls in Prisma/pg below,
// neither of which Edge supports).
const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "mail", "smtp", "ftp", "host", "dev",
  "staging", "stage", "test", "preview", "demo", "sandbox", "blog",
  "docs", "help", "support", "status", "book", "booking", "static",
  "assets", "cdn", "portal", "secure", "vpn", "shop", "store", "git",
]);

/** "Lumière Aesthétique" → "lumiere-aesthetique". Strips accents (NFD
 * normalize + drop combining marks) before lowercasing, so non-ASCII
 * clinic names still produce a clean ASCII subdomain instead of silently
 * dropping every accented letter. */
export function slugifyClinicName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "clinic";
}

/** Appends -2, -3, ... to `base` until it's neither reserved nor already
 * taken by another clinic. Used at clinic-creation time (see
 * lib/db/clinics.ts's createClinic and scripts/createClinic.mjs) — never
 * called for an existing clinic, since a slug shouldn't change out from
 * under a link a clinic has already shared once it's been issued. */
export async function generateUniqueClinicSlug(name: string): Promise<string> {
  const base = slugifyClinicName(name);
  let candidate = base;
  let suffix = 2;
  for (;;) {
    if (!RESERVED_SLUGS.has(candidate)) {
      const existing = await prisma.clinic.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!existing) return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix++;
  }
}
