"use client";

import { useState } from "react";
import { Mail, PenSquare, Send, X } from "lucide-react";
import {
  getThreadMessagesAction,
  sendEmailAction,
  disconnectEmailAction,
} from "@/app/admin/email/actions";
import { RADIANCE_EMAIL_ADDRESS } from "@/lib/gmail/constants";
import type { EmailThreadSummary, EmailMessage } from "@/lib/gmail/client";

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function extractName(fromHeader: string): string {
  const match = fromHeader.match(/^(.*?)\s*<.*>$/);
  return match ? match[1].replace(/"/g, "").trim() : fromHeader;
}

interface ComposeState {
  to: string;
  subject: string;
  body: string;
}

export default function EmailInboxClient({
  initialThreads,
  gmailAccount,
}: {
  initialThreads: EmailThreadSummary[];
  gmailAccount: string;
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [compose, setCompose] = useState<ComposeState | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const selectedThread = threads.find((t) => t.id === selectedId) || null;

  async function handleSelect(thread: EmailThreadSummary) {
    setSelectedId(thread.id);
    setCompose(null);
    setSendError(null);
    setLoadingMessages(true);
    const result = await getThreadMessagesAction(thread.id);
    setLoadingMessages(false);
    if (result.messages) {
      setMessages(result.messages);
      if (thread.unread) {
        setThreads((prev) => prev.map((t) => (t.id === thread.id ? { ...t, unread: false } : t)));
      }
    }
  }

  async function handleReply() {
    if (!selectedThread || !replyText.trim() || messages.length === 0) return;
    setSending(true);
    setSendError(null);

    const lastMessage = messages[messages.length - 1];
    const replyTo = lastMessage.from.includes(RADIANCE_EMAIL_ADDRESS)
      ? lastMessage.to // last message was outbound (us) — reply to whoever it was sent to
      : lastMessage.from;

    const result = await sendEmailAction({
      to: replyTo,
      subject: selectedThread.subject.startsWith("Re:") ? selectedThread.subject : `Re: ${selectedThread.subject}`,
      bodyText: replyText,
      threadId: selectedThread.id,
      inReplyTo: lastMessage.messageIdHeader,
      references: lastMessage.messageIdHeader,
    });
    setSending(false);

    if (result.error) {
      setSendError(result.error);
      return;
    }
    setReplyText("");
    // Refresh the thread so the just-sent reply shows up.
    const refreshed = await getThreadMessagesAction(selectedThread.id);
    if (refreshed.messages) setMessages(refreshed.messages);
  }

  async function handleSendCompose() {
    if (!compose) return;
    setSending(true);
    setSendError(null);
    const result = await sendEmailAction({ to: compose.to, subject: compose.subject, bodyText: compose.body });
    setSending(false);

    if (result.error) {
      setSendError(result.error);
      return;
    }
    setCompose(null);
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect this Gmail account? You'll need to reconnect to read or send email again.")) return;
    setDisconnecting(true);
    await disconnectEmailAction();
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface p-4 shadow-soft ring-1 ring-beige-300">
        <div className="flex items-center gap-2 text-sm text-brown-600">
          <Mail size={15} className="text-gold-600" />
          Connected as <span className="font-medium text-brown-900">{gmailAccount}</span>, sending as{" "}
          <span className="font-medium text-brown-900">{RADIANCE_EMAIL_ADDRESS}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCompose({ to: "", subject: "", body: "" });
              setSelectedId(null);
            }}
            className="flex items-center gap-1.5 rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
          >
            <PenSquare size={14} />
            Compose
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="rounded-md border border-beige-300 px-3 py-2 text-xs font-medium text-brown-600 transition-colors hover:border-red-300 hover:text-red-700 disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 overflow-hidden rounded-xl bg-surface shadow-soft ring-1 ring-beige-300 lg:grid-cols-[340px_1fr] lg:h-[65vh]">
        <div className="overflow-y-auto border-b border-beige-300 lg:border-b-0 lg:border-r">
          {threads.length === 0 ? (
            <div className="p-8 text-center text-sm text-brown-400">No messages yet.</div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => handleSelect(thread)}
                className={`flex w-full flex-col gap-0.5 border-b border-beige-300 px-4 py-3 text-left transition-colors last:border-0 ${
                  selectedId === thread.id ? "bg-gold-100/50" : "hover:bg-beige-100/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${thread.unread ? "font-semibold text-brown-900" : "font-medium text-brown-800"}`}>
                    {thread.participants.map(extractName).join(", ") || "(unknown sender)"}
                  </span>
                  {thread.unread && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-gold-600" />}
                </div>
                <span className="truncate text-xs text-brown-700">{thread.subject}</span>
                <span className="truncate text-xs text-brown-400">{thread.snippet}</span>
              </button>
            ))
          )}
        </div>

        <div className="flex min-h-[400px] flex-col">
          {compose ? (
            <div className="flex flex-1 flex-col p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-base font-medium text-brown-900">New Email</h3>
                <button onClick={() => setCompose(null)} className="text-brown-400 hover:text-brown-700">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  type="email"
                  value={compose.to}
                  onChange={(e) => setCompose({ ...compose, to: e.target.value })}
                  placeholder="To"
                  className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                />
                <input
                  type="text"
                  value={compose.subject}
                  onChange={(e) => setCompose({ ...compose, subject: e.target.value })}
                  placeholder="Subject"
                  className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                />
                <textarea
                  value={compose.body}
                  onChange={(e) => setCompose({ ...compose, body: e.target.value })}
                  rows={10}
                  placeholder="Write your message…"
                  className="w-full flex-1 resize-none rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                />
              </div>
              {sendError && <p className="mt-2 text-xs text-red-700">{sendError}</p>}
              <button
                onClick={handleSendCompose}
                disabled={sending || !compose.to.trim() || !compose.subject.trim() || !compose.body.trim()}
                className="mt-3 flex w-fit items-center gap-1.5 rounded-md bg-brown-900 px-5 py-2.5 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-50"
              >
                <Send size={14} />
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          ) : !selectedThread ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-brown-400">
              Select a conversation, or compose a new one.
            </div>
          ) : (
            <>
              <div className="border-b border-beige-300 px-5 py-3">
                <div className="text-sm font-medium text-brown-900">{selectedThread.subject}</div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {loadingMessages ? (
                  <p className="text-center text-sm text-brown-400">Loading…</p>
                ) : (
                  messages.map((message) => {
                    const isOutbound = message.from.includes(RADIANCE_EMAIL_ADDRESS);
                    return (
                      <div key={message.id} className={`rounded-lg border p-3.5 ${isOutbound ? "border-gold-500/40 bg-gold-100/30" : "border-beige-300 bg-canvas"}`}>
                        <div className="flex items-center justify-between gap-2 text-xs text-brown-500">
                          <span className="font-medium text-brown-800">{extractName(message.from)}</span>
                          <span>{formatDate(message.date)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-brown-900">{message.body}</p>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="border-t border-beige-300 p-3">
                {sendError && <p className="mb-2 text-xs text-red-700">{sendError}</p>}
                <div className="flex items-end gap-2">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Type a reply…"
                    rows={2}
                    className="flex-1 resize-none rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                  />
                  <button
                    onClick={handleReply}
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
    </div>
  );
}
