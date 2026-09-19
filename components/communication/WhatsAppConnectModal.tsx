"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Copy } from "lucide-react";
import { connectWhatsAppAction, disconnectWhatsAppAction } from "@/app/dashboard/communication/actions";
import type { WhatsAppConnection } from "@/types";

/** The connection form (Meta Cloud API credentials) and the webhook setup
 * info used to live as two always-visible cards on the page — moved into
 * one modal behind the setup banner's "Set Up Connection" button, since
 * this is a one-time setup flow, not something to keep taking up room
 * once it's done. No OAuth popup or partner account: each clinic brings
 * its own phone number id + System User access token from their own Meta
 * Business Account, saved directly and used on every send. There's no
 * live validation call to check them against before saving — a wrong
 * token only surfaces on the first real send (or on "Send Test" in
 * Message Templates). */
export default function WhatsAppConnectModal({
  connection: initialConnection,
  verifyToken,
  onClose,
  onConnected,
  onDisconnected,
}: {
  connection: WhatsAppConnection | null;
  verifyToken: string | null;
  onClose: () => void;
  onConnected: (connection: WhatsAppConnection) => void;
  onDisconnected: () => void;
}) {
  const [connection, setConnection] = useState(initialConnection);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState(connection?.phoneNumberId || "");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [wabaId, setWabaId] = useState(connection?.wabaId || "");
  const [phoneNumber, setPhoneNumber] = useState(connection?.phoneNumber || "");

  const [origin, setOrigin] = useState("");
  const [copiedField, setCopiedField] = useState<"url" | "token" | null>(null);
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const callbackUrl = origin ? `${origin}/api/webhooks/whatsapp` : "/api/webhooks/whatsapp";

  async function copy(field: "url" | "token", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Clipboard API can be unavailable — the value is still visible and
      // selectable, so this just no-ops.
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await connectWhatsAppAction(
      phoneNumberId.trim(),
      accessToken.trim(),
      appSecret.trim(),
      wabaId.trim(),
      phoneNumber.trim()
    );
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const next: WhatsAppConnection = {
      id: "",
      clinicId: "",
      status: "connected",
      phoneNumberId: phoneNumberId.trim(),
      ...(wabaId.trim() ? { wabaId: wabaId.trim() } : {}),
      ...(phoneNumber.trim() ? { phoneNumber: phoneNumber.trim() } : {}),
      updatedAt: Date.now(),
    };
    setConnection(next);
    setAccessToken("");
    setAppSecret("");
    onConnected(next);
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect WhatsApp? Reminders and receipts will stop sending until reconnected.")) return;
    setBusy(true);
    const result = await disconnectWhatsAppAction();
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setConnection(null);
    onDisconnected();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm sm:p-6">
      <div className="flex h-full max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[18px] border border-beige-300 bg-white shadow-xl">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-beige-300 px-6 pb-6 pt-6">
          <div className="inline-flex flex-col items-start">
            <h2 className="m-0 text-2xl font-extrabold tracking-tight text-brown-900">WhatsApp Connection</h2>
            <div className="mt-1.5 h-[3px] w-full rounded-full bg-rust-600" />
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-canvas/30 p-6">
          <p className="text-sm font-medium leading-relaxed text-brown-600">
            From your own Meta Business Account: Phone Number ID and App Secret from the App Dashboard, and a
            permanent access token from Business Settings &gt; System Users. See{" "}
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-rust-600 hover:text-rust-700"
            >
              Meta&apos;s Cloud API setup guide
            </a>
            .
          </p>

          {connection?.status === "connected" && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3">
              <span className="text-sm font-bold text-green-700">
                Connected &middot; {connection.phoneNumber || connection.phoneNumberId}
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-[18px]">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-brown-400">Phone Number ID</label>
              <input
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                placeholder="e.g. 109876543212345"
                required
                className="w-full rounded-[10px] border border-beige-300 bg-white px-4 py-2.5 text-sm text-brown-900 shadow-sm outline-none transition-colors focus:border-rust-600/50"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-brown-400">Access Token</label>
              <input
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                type="password"
                placeholder={connection ? "Enter to change" : "Permanent System User token"}
                required={!connection}
                className="w-full rounded-[10px] border border-beige-300 bg-white px-4 py-2.5 text-sm text-brown-900 shadow-sm outline-none transition-colors focus:border-rust-600/50"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-brown-400">App Secret</label>
              <input
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                type="password"
                placeholder={connection ? "Enter to change" : "From App Dashboard > Settings > Basic"}
                required={!connection}
                className="w-full rounded-[10px] border border-beige-300 bg-white px-4 py-2.5 text-sm text-brown-900 shadow-sm outline-none transition-colors focus:border-rust-600/50"
              />
              <p className="text-xs font-medium text-brown-400">
                Used to verify inbound messages actually came from Meta. Never shared anywhere else.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-brown-400">
                WhatsApp Business Account ID <span className="normal-case text-brown-400/70">(optional)</span>
              </label>
              <input
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                placeholder="e.g. 987654321098765"
                className="w-full rounded-[10px] border border-beige-300 bg-white px-4 py-2.5 text-sm text-brown-900 shadow-sm outline-none transition-colors focus:border-rust-600/50"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-brown-400">
                WhatsApp Number <span className="normal-case text-brown-400/70">(optional)</span>
              </label>
              <input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. +919876543210"
                className="w-full rounded-[10px] border border-beige-300 bg-white px-4 py-2.5 text-sm text-brown-900 shadow-sm outline-none transition-colors focus:border-rust-600/50"
              />
              <p className="text-xs font-medium text-brown-400">
                Shown in the connection status above, for your reference only.
              </p>
            </div>

            {error && <p className="text-sm text-red-700">{error}</p>}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-rust-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-rust-700 disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save"}
              </button>
              {connection && (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={busy}
                  className="text-sm font-bold text-red-700 hover:underline disabled:opacity-60"
                >
                  Disconnect
                </button>
              )}
            </div>
          </form>

          <div className="mt-6 flex flex-col gap-3 border-t border-beige-300 pt-6">
            <div>
              <h3 className="text-sm font-extrabold text-brown-900">Webhook Setup</h3>
              <p className="mt-1 text-xs font-medium leading-relaxed text-brown-400">
                Paste these into your Meta App&apos;s WhatsApp &gt; Configuration &gt; Webhooks screen to receive
                patient replies in your Inbox.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-brown-400">Callback URL</label>
              <div className="flex items-center gap-2 rounded-[10px] border border-beige-300 bg-white px-3.5 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-brown-700">{callbackUrl}</span>
                <button
                  type="button"
                  onClick={() => copy("url", callbackUrl)}
                  className="flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-rust-600 transition-colors hover:bg-rust-100"
                >
                  {copiedField === "url" ? <Check size={13} /> : <Copy size={13} />}
                  {copiedField === "url" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-brown-400">Verify Token</label>
              {verifyToken ? (
                <div className="flex items-center gap-2 rounded-[10px] border border-beige-300 bg-white px-3.5 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-brown-700">{verifyToken}</span>
                  <button
                    type="button"
                    onClick={() => copy("token", verifyToken)}
                    className="flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-rust-600 transition-colors hover:bg-rust-100"
                  >
                    {copiedField === "token" ? <Check size={13} /> : <Copy size={13} />}
                    {copiedField === "token" ? "Copied" : "Copy"}
                  </button>
                </div>
              ) : (
                <p className="rounded-[10px] bg-[#FBEEE9] px-3.5 py-2.5 text-xs font-semibold text-rust-700">
                  Not set up yet. Add WHATSAPP_WEBHOOK_VERIFY_TOKEN to the server&apos;s environment first.
                </p>
              )}
            </div>

            <p className="text-xs font-medium leading-relaxed text-brown-400">
              Same URL and token for every clinic. Meta only uses these once, to confirm the callback is really
              ours. The real per-message authentication is each clinic&apos;s own App Secret, above.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 items-center justify-end border-t border-beige-300 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-bold text-brown-400 transition-colors hover:text-brown-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
