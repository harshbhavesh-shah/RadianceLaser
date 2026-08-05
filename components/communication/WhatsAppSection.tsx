"use client";

import { useState, type FormEvent } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import {
  beginManagedConnectionAction,
  connectByoAction,
  disconnectWhatsAppAction,
} from "@/app/dashboard/communication/actions";
import type { WhatsAppConnection } from "@/types";

type Mode = "choose" | "byo";

/** Connection card for the clinic's WhatsApp Business number — see
 * types/index.ts WhatsAppConnection for the managed-vs-BYO distinction, and
 * lib/whatsapp/gupshupClient.ts for what's real vs. stubbed pending a live
 * Gupshup partner account. Both paths here hit real server actions and
 * surface real errors — there's no fake "connected" state without an
 * actual working connection. */
export default function WhatsAppSection({
  initialConnection,
  canEdit,
}: {
  initialConnection: WhatsAppConnection | null;
  canEdit: boolean;
}) {
  const [connection, setConnection] = useState(initialConnection);
  const [mode, setMode] = useState<Mode>("choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [byoAppId, setByoAppId] = useState("");
  const [byoApiKey, setByoApiKey] = useState("");

  async function handleManagedConnect() {
    setBusy(true);
    setError(null);
    try {
      const result = await beginManagedConnectionAction();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.signupUrl) {
        window.open(result.signupUrl, "_blank", "width=500,height=700");
        setError(
          "Embedded signup opened in a new window. Once you've connected your number there, this page will need a real Gupshup webhook callback to finish automatically — that part isn't wired up yet."
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleByoSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await connectByoAction(byoAppId.trim(), byoApiKey.trim());
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setConnection({
      id: "",
      clinicId: "",
      mode: "byo",
      status: "connected",
      updatedAt: Date.now(),
    });
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
    setMode("choose");
  }

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-brown-900">WhatsApp Messaging</h2>
          <p className="mt-0.5 text-xs text-brown-400">
            Send appointment reminders, confirmations, and receipts over WhatsApp.
          </p>
        </div>
        {connection?.status === "connected" && (
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            Connected{connection.displayPhoneNumber ? ` · ${connection.displayPhoneNumber}` : ""}
          </span>
        )}
      </div>

      {!canEdit ? (
        <p className="mt-4 text-sm text-brown-400">Only the clinic owner can manage this.</p>
      ) : connection?.status === "connected" ? (
        <div className="mt-4">
          <button
            onClick={handleDisconnect}
            disabled={busy}
            className="rounded-md border border-beige-300 px-4 py-2 text-sm font-medium text-brown-700 transition-colors hover:border-red-300 hover:text-red-700 disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      ) : mode === "choose" ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={handleManagedConnect}
            disabled={busy}
            className="flex flex-col items-start gap-2 rounded-lg border border-beige-300 p-4 text-left transition-colors hover:border-gold-500 disabled:opacity-50"
          >
            <MessageCircle className="text-gold-600" size={20} />
            <span className="text-sm font-semibold text-brown-900">Quick Connect</span>
            <span className="text-xs text-brown-400">
              Connect your WhatsApp number in one click — we handle the setup.
            </span>
            {busy && <Loader2 className="animate-spin text-brown-400" size={16} />}
          </button>
          <button
            onClick={() => setMode("byo")}
            className="flex flex-col items-start gap-2 rounded-lg border border-beige-300 p-4 text-left transition-colors hover:border-gold-500"
          >
            <MessageCircle className="text-brown-400" size={20} />
            <span className="text-sm font-semibold text-brown-900">Use my own Gupshup account</span>
            <span className="text-xs text-brown-400">Already have a Gupshup WhatsApp API app? Connect it directly.</span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleByoSubmit} className="mt-4 max-w-sm space-y-3">
          <div>
            <label className="text-sm font-medium text-brown-700">Gupshup App ID</label>
            <input
              value={byoAppId}
              onChange={(e) => setByoAppId(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-brown-700">API Key</label>
            <input
              value={byoApiKey}
              onChange={(e) => setByoApiKey(e.target.value)}
              type="password"
              required
              className="mt-1 w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-50"
            >
              {busy ? "Connecting…" : "Connect"}
            </button>
            <button
              type="button"
              onClick={() => setMode("choose")}
              className="text-sm font-medium text-brown-600 hover:underline"
            >
              Back
            </button>
          </div>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
