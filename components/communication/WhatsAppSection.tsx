"use client";

import { useState, type FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import { connectWhatsAppAction, disconnectWhatsAppAction } from "@/app/dashboard/communication/actions";
import type { WhatsAppConnection } from "@/types";

/** Connection card for the clinic's BhashSMS WhatsApp account — see
 * types/index.ts WhatsAppConnection and lib/bhashsms/client.ts. Unlike the
 * old Gupshup flow, there's no OAuth popup or partner account: BhashSMS is
 * just a username/password/sender id, saved directly and used on every
 * send. There's no live validation call to check them against before
 * saving — a wrong password only surfaces on the first real send. */
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
  const [bhashUser, setBhashUser] = useState(connection?.bhashUser || "");
  const [bhashPass, setBhashPass] = useState("");
  const [senderId, setSenderId] = useState(connection?.senderId || "");
  const [phoneNumber, setPhoneNumber] = useState(connection?.phoneNumber || "");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await connectWhatsAppAction(bhashUser.trim(), bhashPass.trim(), senderId.trim(), phoneNumber.trim());
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setConnection({
      id: "",
      clinicId: "",
      status: "connected",
      bhashUser: bhashUser.trim(),
      senderId: senderId.trim(),
      ...(phoneNumber.trim() ? { phoneNumber: phoneNumber.trim() } : {}),
      updatedAt: Date.now(),
    });
    setBhashPass("");
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
            Send appointment reminders, confirmations, and receipts over WhatsApp via BhashSMS.
          </p>
        </div>
        {connection?.status === "connected" && !editing && (
          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            Connected · {connection.bhashUser}
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
              From your BhashSMS account's WhatsApp API details — the same username, password, and sender id used in
              their sendmsg.php URL.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-brown-700">BhashSMS Username</label>
            <input
              value={bhashUser}
              onChange={(e) => setBhashUser(e.target.value)}
              required
              className="mt-1 w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-brown-700">Password</label>
            <input
              value={bhashPass}
              onChange={(e) => setBhashPass(e.target.value)}
              type="password"
              placeholder={connection ? "Enter to change" : undefined}
              required={!connection}
              className="mt-1 w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-brown-700">Sender ID</label>
            <input
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              placeholder="e.g. BUZWAP"
              required
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
            <p className="mt-1 text-xs text-brown-400">
              The clinic's own WhatsApp Business number — needed so patient replies land in your Inbox.
            </p>
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
