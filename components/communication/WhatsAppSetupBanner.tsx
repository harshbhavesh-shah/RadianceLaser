"use client";

import { useState } from "react";
import WhatsAppConnectModal from "./WhatsAppConnectModal";
import type { WhatsAppConnection } from "@/types";

/** A single setup banner, separated from the day-to-day content below it
 * (templates, feedback, booking link, automation toggles) instead of an
 * always-visible connection form taking up permanent room on the page —
 * this is a one-time setup step, not something to keep looking at once
 * it's done. Not shown at all once connected and there's nothing to fix,
 * matching the reference design's own "gets out of the way" framing;
 * connected clinics can still reach the same modal (to edit or
 * disconnect) via WhatsApp Messaging's own row where it's referenced. */
export default function WhatsAppSetupBanner({
  connection: initialConnection,
  verifyToken,
  canEdit,
  onConnectionChange,
}: {
  connection: WhatsAppConnection | null;
  verifyToken: string | null;
  canEdit: boolean;
  onConnectionChange: (connection: WhatsAppConnection | null) => void;
}) {
  const [connection, setConnection] = useState(initialConnection);
  const [modalOpen, setModalOpen] = useState(false);

  const isConnected = connection?.status === "connected";

  return (
    <>
      <div
        className={`flex flex-col items-start gap-4 rounded-2xl bg-surface px-[26px] py-5 sm:flex-row sm:items-center sm:justify-between ${
          isConnected ? "border border-beige-300" : "border border-[#EFC9BB]"
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg ${
              isConnected ? "bg-green-50 text-green-700" : "bg-[#FBEEE9] text-rust-600"
            }`}
          >
            &#9679;
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-base font-extrabold text-brown-900">
              {isConnected ? "WhatsApp is connected" : "WhatsApp isn't connected yet"}
            </div>
            <div className="text-[13px] font-medium text-brown-400">
              {isConnected
                ? `Sending as ${connection.phoneNumber || connection.phoneNumberId}.`
                : "Connect your Meta Business account to send reminders, receipts, and follow-ups automatically."}
            </div>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setModalOpen(true)}
            className={`flex-shrink-0 whitespace-nowrap rounded-[10px] px-5 py-3 text-sm font-bold transition-colors ${
              isConnected
                ? "border border-beige-300 bg-surface text-brown-900 hover:bg-beige-100/60"
                : "bg-rust-600 text-white hover:bg-rust-700"
            }`}
          >
            {isConnected ? "Manage Connection" : "Set Up Connection"}
          </button>
        )}
      </div>

      {modalOpen && (
        <WhatsAppConnectModal
          connection={connection}
          verifyToken={verifyToken}
          onClose={() => setModalOpen(false)}
          onConnected={(next) => {
            setConnection(next);
            onConnectionChange(next);
            setModalOpen(false);
          }}
          onDisconnected={() => {
            setConnection(null);
            onConnectionChange(null);
          }}
        />
      )}
    </>
  );
}
