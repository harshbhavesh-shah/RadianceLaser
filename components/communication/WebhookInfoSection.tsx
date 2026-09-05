"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Webhook } from "lucide-react";

/** The two values every clinic needs to paste into their own Meta App's
 * Webhooks configuration (App Dashboard > WhatsApp > Configuration) to
 * start receiving inbound messages — same endpoint for every clinic, since
 * app/api/webhooks/whatsapp/route.ts routes each event by its own
 * phoneNumberId. Client-only because the callback URL's origin isn't known
 * until the page has actually loaded in a browser. */
export default function WebhookInfoSection({ verifyToken }: { verifyToken: string | null }) {
  const [origin, setOrigin] = useState("");
  const [copiedField, setCopiedField] = useState<"url" | "token" | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const callbackPath = "/api/webhooks/whatsapp";
  const callbackUrl = origin ? `${origin}${callbackPath}` : callbackPath;

  async function copy(field: "url" | "token", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Clipboard API can be unavailable — the value is still visible and
      // selectable below, so this just no-ops.
    }
  }

  return (
    <div className="rounded-xl bg-surface p-5 shadow-soft ring-1 ring-beige-300">
      <div className="flex items-center gap-2">
        <Webhook size={16} className="text-gold-600" />
        <h2 className="font-display text-base font-medium text-brown-900">Webhook Setup</h2>
      </div>
      <p className="mt-1.5 text-sm text-brown-600">
        Paste these into your Meta App's WhatsApp &gt; Configuration &gt; Webhooks screen to receive patient replies
        in your Inbox.
      </p>

      <div className="mt-3 space-y-2.5">
        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-brown-400">Callback URL</label>
          <div className="mt-1 flex items-center gap-2 rounded-md border border-beige-300 bg-canvas px-3 py-2">
            <span className="flex-1 truncate text-sm text-brown-700">{callbackUrl}</span>
            <button
              type="button"
              onClick={() => copy("url", callbackUrl)}
              className="flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gold-600 transition-colors hover:bg-gold-100"
            >
              {copiedField === "url" ? <Check size={13} /> : <Copy size={13} />}
              {copiedField === "url" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wide text-brown-400">Verify Token</label>
          {verifyToken ? (
            <div className="mt-1 flex items-center gap-2 rounded-md border border-beige-300 bg-canvas px-3 py-2">
              <span className="flex-1 truncate text-sm text-brown-700">{verifyToken}</span>
              <button
                type="button"
                onClick={() => copy("token", verifyToken)}
                className="flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gold-600 transition-colors hover:bg-gold-100"
              >
                {copiedField === "token" ? <Check size={13} /> : <Copy size={13} />}
                {copiedField === "token" ? "Copied" : "Copy"}
              </button>
            </div>
          ) : (
            <p className="mt-1 rounded-md border border-gold-500/40 bg-gold-100/50 p-2 text-xs text-brown-700">
              Not set up yet — add WHATSAPP_WEBHOOK_VERIFY_TOKEN to the server's environment first.
            </p>
          )}
        </div>
      </div>

      <p className="mt-3 text-xs text-brown-400">
        Same URL and token for every clinic — Meta only uses these once, to confirm the callback is really ours. The
        real per-message authentication is each clinic's own App Secret, entered below.
      </p>
    </div>
  );
}
