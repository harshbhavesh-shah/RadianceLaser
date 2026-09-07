import "server-only";
import { headers } from "next/headers";

/**
 * Best-effort client IP for a Server Action (which, unlike a Route Handler,
 * has no request object to read directly) — Vercel sets `x-forwarded-for`
 * on every request it proxies, with the real client first in the list.
 * Falls back to a shared "unknown" bucket rather than throwing when the
 * header is missing (e.g. local dev without a proxy in front) — that just
 * means every such request shares one rate-limit bucket, which is
 * acceptable degradation, not a broken feature.
 */
export function getClientIp(): string {
  const forwardedFor = headers().get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
}
