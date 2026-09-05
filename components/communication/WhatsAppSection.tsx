"use client";

import { useState, type FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import { connectWhatsAppAction, disconnectWhatsAppAction } from "@/app/dashboard/communication/actions";
import type { WhatsAppConnection } from "@/types";

/** Connection card for the clinic's official Meta WhatsApp Cloud API
 * account — see types/index.ts WhatsAppConnection and
 * lib/whatsapp/providers/metaCloudApi.ts. No OAuth popup or partner
 * account: each clinic brings its own phone number id + System User access
 * token from their own Meta Business Account, saved directly and used on
 * every send. There's no live validation call to check them against before
 * saving — a wrong token only surfaces on the first real send (or on
 * "Send Test" in Message Templates below). */
export default function WhatsAppSection({
  initialConnection,
  canEdit,
}: {
  initialConnection: WhatsAppConnection | null;
  canEdit: boolean;
}) {
  const [connection, setConnection] = useState(initialConnection);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState(connection?.phoneNumberId || "");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [wabaId, setWabaId] = useState(connection?.wabaId || "");
  const [phoneNumber, setPhoneNumber] = useState(connection?.phoneNumber || "");

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
    setConnection({
      id: "",
      clinicId: "",
      status: "connected",
      phoneNumberId: phoneNumberId.trim(),
      ...(wabaId.trim() ? { wabaId: wabaId.trim() } : {}),
      ...(phoneNumber.trim() ? { phoneNumber: phoneNumber.trim() } : {}),
      updatedAt: Date.now(),
    });
    setAccessToken("");
    setAppSecret("");
    setEditing(false);
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
    setEditing(false);
  }

  const showForm = editing || !connection || connection.status !== "connected";

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-brown-900">WhatsApp Messaging</h2>
          <p className="mt-0.5 text-xs text-brown-400">
            Send appointment reminders, confirmations, and receipts over the official Meta WhatsApp Cloud API.
          </p>
        </div>
        {connection?.status === "connected" && !editing && (
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            Connected · {connection.phoneNumber || connection.phoneNumberId}
          </span>
        )}
      </div>

      {!canEdit ? (
        <p className="mt-4 text-sm text-brown-400">Only the clinic owner can manage this.</p>
      ) : !showForm ? (
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded-md border border-beige-300 px-4 py-2 text-sm font-medium text-brown-700 transition-colors hover:border-gold-500"
          >
            Edit
          </button>
          <button
            onClick={handleDisconnect}
            disabled={busy}
            className="rounded-md border border-beige-300 px-4 py-2 text-sm font-medium text-brown-700 transition-colors hover:border-red-300 hover:text-red-700 disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 max-w-sm space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-beige-300 bg-canvas p-3">
            <MessageCircle className="mt-0.5 flex-shrink-0 text-gold-600" size={16} />
            <p className="text-xs text-brown-600">
              From your own Meta Business Account — Phone Number ID and App Secret from the App Dashboard, and a
              permanent access token from Business Settings &gt; System Users. See{" "}
              <a
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-gold-600 hover:underline"
              >
                Meta's Cloud API setup guide
              </a>
              .
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-brown-700">Phone Number ID</label>
            <input
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="e.g. 109876543212345"
              required
              className="mt-1 w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-brown-700">Access Token</label>
            <input
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              type="password"
              placeholder={connection ? "Enter to change" : "Permanent System User token"}
              required={!connection}
              className="mt-1 w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-brown-700">App Secret</label>
            <input
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              type="password"
              placeholder={connection ? "Enter to change" : "From App Dashboard > Settings > Basic"}
              required={!connection}
              className="mt-1 w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500"
            />
            <p className="mt-1 text-xs text-brown-400">
              Used to verify inbound messages actually came from Meta — never shared anywhere else.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-brown-700">
              WhatsApp Business Account ID <span className="text-brown-400">(optional)</span>
            </label>
            <input
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              placeholder="e.g. 987654321098765"
              className="mt-1 w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-brown-700">
              WhatsApp Number <span className="text-brown-400">(optional)</span>
            </label>
            <input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g. +919876543210"
              className="mt-1 w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500"
            />
            <p className="mt-1 text-xs text-brown-400">Shown in the connection status above — for your reference only.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            {connection && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-sm font-medium text-brown-600 hover:underline"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
