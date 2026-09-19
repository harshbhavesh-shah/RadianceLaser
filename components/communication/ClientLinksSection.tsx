"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

// The bare root domain the main app itself lives on — kept in sync by
// hand with middleware.ts's own ROOT_DOMAIN (same env var, same default);
// used here only to decide whether the current origin can build a real
// {slug}.{root} subdomain URL (production) or should fall back to the
// old /book/{id} path (local dev, a Vercel preview deploy — neither has
// the wildcard subdomain set up).
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "radiancelaser.in";

/** Surfaces the clinic's own public booking link — the thing to paste into
 * a website, Instagram bio, or WhatsApp broadcast. Client-only because the
 * current origin isn't known until the page has actually loaded in a
 * browser. */
export default function ClientLinksSection({ clinicId, clinicSlug }: { clinicId: string; clinicSlug: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  let bookingUrl = `/book/${clinicId}`; // fallback before origin is known, or if this isn't the production host
  if (origin) {
    try {
      const { protocol, hostname, port } = new URL(origin);
      // Keep the port (":3000" in local dev) — dropping it would build a
      // link that looks right but 404s the moment it's actually clicked.
      const portSuffix = port ? `:${port}` : "";
      if (clinicSlug && (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`)) {
        bookingUrl = `${protocol}//${clinicSlug}.${ROOT_DOMAIN}${portSuffix}`;
      } else {
        bookingUrl = `${origin}/book/${clinicSlug || clinicId}`;
      }
    } catch {
      bookingUrl = `${origin}/book/${clinicSlug || clinicId}`;
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (e.g. insecure context) — the URL
      // is still selectable text below, so this just no-ops rather than
      // showing an error for something the user can work around themselves.
    }
  }

  return (
    <div className="flex flex-col gap-3.5 rounded-[18px] bg-surface p-6 shadow-soft">
      <h2 className="text-[17px] font-extrabold text-brown-900">Patient Booking Link</h2>
      <p className="text-[13px] font-medium leading-relaxed text-brown-600">
        Share this so patients can book themselves. Returning patients see their past sessions and can book the
        same treatment again; new patients book straight in.
      </p>

      <div className="flex items-center gap-2 rounded-[10px] border border-beige-300 bg-[#FCFAF7] px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate text-[13px] text-brown-600">{bookingUrl}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-rust-600 transition-colors hover:bg-rust-100"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <a
        href={bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-[13px] font-bold text-rust-600 hover:text-rust-700"
      >
        <ExternalLink size={12} />
        Open the booking page
      </a>
    </div>
  );
}
