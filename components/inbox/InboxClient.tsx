"use client";

import { useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import {
  loadConversationMessagesAction,
  markConversationReadAction,
  sendReplyAction,
} from "@/app/dashboard/inbox/actions";
import type { WhatsAppConversation, WhatsAppMessage } from "@/types";

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** The two-way WhatsApp inbox — a conversation list on the left, the
 * selected thread and a reply composer on the right, same layout
 * convention as any chat UI (list narrow, thread wide) rather than the
 * content/sidebar split used elsewhere in the dashboard, since here both
 * panels are equally "content," just at different zoom levels. */
export default function InboxClient({ initialConversations }: { initialConversations: WhatsAppConversation[] }) {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const selected = conversations.find((c) => c.id === selectedId) || null;

  async function handleSelect(conversation: WhatsAppConversation) {
    setSelectedId(conversation.id);
    setSendError(null);
    setLoadingMessages(true);
    const [loaded] = await Promise.all([
      loadConversationMessagesAction(conversation.id),
      conversation.unreadCount > 0 ? markConversationReadAction(conversation.id) : Promise.resolve(),
    ]);
    setMessages(loaded);
    setLoadingMessages(false);
    if (conversation.unreadCount > 0) {
      setConversations((prev) => prev.map((c) => (c.id === conversation.id ? { ...c, unreadCount: 0 } : c)));
    }
  }

  async function handleSend() {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    setSendError(null);
    const result = await sendReplyAction(selected.id, replyText);
    setSending(false);
    if ("error" in result) {
      setSendError(result.error);
      return;
    }
    setMessages((prev) => [...prev, result.message]);
    setReplyText("");
    setConversations((prev) =>
      prev.map((c) => (c.id === selected.id ? { ...c, lastMessagePreview: result.message.body, lastMessageAt: result.message.createdAt } : c))
    );
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="No conversations yet."
        description="Once a patient replies to a WhatsApp message, their conversation shows up here."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-xl bg-surface shadow-soft ring-1 ring-beige-300 lg:grid-cols-[340px_1fr] lg:h-[70vh]">
      <div className="overflow-y-auto border-b border-beige-300 lg:border-b-0 lg:border-r">
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => handleSelect(c)}
            className={`flex w-full flex-col gap-0.5 border-b border-beige-300 px-4 py-3 text-left transition-colors last:border-0 ${
              selected?.id === c.id ? "bg-gold-100/50" : "hover:bg-beige-100/60"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-brown-900">{c.patientName || c.phoneNumber}</span>
              {c.unreadCount > 0 && (
                <span className="flex-shrink-0 rounded-full bg-gold-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {c.unreadCount}
                </span>
              )}
            </div>
            <span className="truncate text-xs text-brown-400">{c.lastMessagePreview}</span>
          </button>
        ))}
      </div>

      <div className="flex min-h-[400px] flex-col">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-brown-400">
            Select a conversation to view it.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 border-b border-beige-300 px-5 py-3">
              <div>
                <div className="text-sm font-medium text-brown-900">{selected.patientName || "Unknown patient"}</div>
                <div className="text-xs text-brown-400">{selected.phoneNumber}</div>
              </div>
              {selected.patientId && (
                <Link
                  href={`/dashboard/patients/${selected.patientId}`}
                  className="flex-shrink-0 text-xs font-medium text-gold-600 hover:underline"
                >
                  View patient
                </Link>
              )}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {loadingMessages ? (
                <p className="text-center text-sm text-brown-400">Loading…</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-xl px-3.5 py-2 text-sm ${
                        m.direction === "outbound" ? "bg-brown-900 text-beige-100" : "bg-beige-200 text-brown-900"
                      }`}
                    >
                      <p>{m.body}</p>
                      <p className={`mt-1 text-[10px] ${m.direction === "outbound" ? "text-beige-300/70" : "text-brown-400"}`}>
                        {formatTimestamp(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-beige-300 p-3">
              {sendError && <p className="mb-2 text-xs text-red-700">{sendError}</p>}
              <div className="flex items-end gap-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a reply…"
                  rows={1}
                  className="flex-1 resize-none rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !replyText.trim()}
                  className="flex-shrink-0 rounded-md bg-brown-900 p-2.5 text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-50"
                  aria-label="Send reply"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
