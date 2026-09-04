"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";

/** Surfaces the clinic's own public booking link — the thing to paste into
 * a website, Instagram bio, or WhatsApp broadcast. Client-only because the
 * full URL (protocol + host) isn't known until the page has actually
 * loaded in a browser; the path itself never changes. */
export default function ClientLinksSection({ clinicId }: { clinicId: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const bookingPath = `/book/${clinicId}`;
  const bookingUrl = origin ? `${origin}${bookingPath}` : bookingPath;

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
    <div className="rounded-xl bg-surface p-5 shadow-soft ring-1 ring-beige-300">
      <div className="flex items-center gap-2">
        <Link2 size={16} className="text-gold-600" />
        <h2 className="font-display text-base font-medium text-brown-900">Patient Booking Link</h2>
      </div>
      <p className="mt-1.5 text-sm text-brown-600">
        Share this so patients can book themselves — returning patients see their past sessions and can book the
        same treatment again; new patients book straight in.
      </p>

      <div className="mt-3 flex items-center gap-2 rounded-md border border-beige-300 bg-canvas px-3 py-2">
        <span className="flex-1 truncate text-sm text-brown-700">{bookingUrl}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gold-600 transition-colors hover:bg-gold-100"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <a
        href={bookingPath}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-brown-500 hover:text-gold-600"
      >
        <ExternalLink size={12} />
        Open the booking page
      </a>
    </div>
  );
}
