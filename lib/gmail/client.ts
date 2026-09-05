import "server-only";
import { getEmailConnection, updateCachedAccessToken } from "@/lib/db/emailConnection";
import { refreshAccessToken } from "@/lib/gmail/oauth";
import { RADIANCE_EMAIL_ADDRESS } from "@/lib/gmail/constants";

// The Gmail API wrapper backing app/admin/email — read, send, and reply as
// admin@radiancelaser.in (a verified "Send mail as" alias on the connected
// Gmail account, see prisma/schema.prisma's EmailConnection comment).
// Deliberately scoped to exactly what the inbox UI needs, not a general
// Gmail client: list threads, fetch one thread's messages, send a message.

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Returns a valid access token, refreshing it first if the cached one is
 * missing or expired. Every Gmail API call in this file goes through this
 * rather than reading EmailConnection.accessToken directly. */
async function getValidAccessToken(): Promise<string> {
  const connection = await getEmailConnection();
  if (!connection) throw new Error("Gmail isn't connected yet.");

  if (connection.accessToken && connection.accessTokenExpiresAt && connection.accessTokenExpiresAt > Date.now()) {
    return connection.accessToken;
  }

  const { accessToken, expiresAt } = await refreshAccessToken(connection.refreshToken);
  await updateCachedAccessToken(accessToken, expiresAt);
  return accessToken;
}

async function gmailFetch(path: string, init?: RequestInit): Promise<unknown> {
  const accessToken = await getValidAccessToken();
  const res = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` },
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Gmail API error (${res.status}): ${raw}`);
  return raw ? JSON.parse(raw) : null;
}

// --- Base64url helpers — Gmail encodes message bodies and raw sends in
// base64url (RFC 4648 §5), not the plain base64 Buffer defaults to. ---
function base64UrlDecode(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPart {
  mimeType: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

/** Walks a (possibly nested multipart) message payload looking for a
 * text/plain part first, falling back to text/html (stripped to plain
 * text — this is a preview/read surface, never dangerouslySetInnerHTML,
 * so a malicious sender's HTML can't do anything). */
function extractBody(payload: GmailPart): string {
  function findPart(part: GmailPart, mimeType: string): GmailPart | null {
    if (part.mimeType === mimeType && part.body?.data) return part;
    for (const child of part.parts ?? []) {
      const found = findPart(child, mimeType);
      if (found) return found;
    }
    return null;
  }

  const plain = findPart(payload, "text/plain");
  if (plain?.body?.data) return base64UrlDecode(plain.body.data);

  const html = findPart(payload, "text/html");
  if (html?.body?.data) return stripHtml(base64UrlDecode(html.body.data));

  return "";
}

function headerValue(headers: GmailHeader[], name: string): string | undefined {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: number; // epoch ms
  body: string;
  messageIdHeader?: string; // RFC 822 Message-ID, needed for In-Reply-To/References on a send
  unread: boolean;
}

export interface EmailThreadSummary {
  id: string;
  subject: string;
  snippet: string;
  lastMessageDate: number;
  unread: boolean;
  participants: string[];
}

interface GmailMessageRow {
  id: string;
  threadId: string;
  snippet: string;
  labelIds?: string[];
  internalDate: string;
  payload: GmailPart & { headers: GmailHeader[] };
}

function toEmailMessage(row: GmailMessageRow): EmailMessage {
  const headers = row.payload.headers;
  return {
    id: row.id,
    threadId: row.threadId,
    from: headerValue(headers, "From") || "",
    to: headerValue(headers, "To") || "",
    subject: headerValue(headers, "Subject") || "(no subject)",
    date: Number(row.internalDate),
    body: extractBody(row.payload),
    messageIdHeader: headerValue(headers, "Message-ID"),
    unread: (row.labelIds ?? []).includes("UNREAD"),
  };
}

/**
 * Threads addressed to (or from) admin@radiancelaser.in, newest first.
 * Scoped with a Gmail search query rather than listing the whole
 * underlying account's mail — that inbox may receive plenty that has
 * nothing to do with this alias.
 */
export async function listThreads(): Promise<EmailThreadSummary[]> {
  const query = encodeURIComponent(`to:${RADIANCE_EMAIL_ADDRESS} OR from:${RADIANCE_EMAIL_ADDRESS}`);
  const list = (await gmailFetch(`/threads?q=${query}&maxResults=50`)) as {
    threads?: { id: string }[];
  } | null;
  const threadStubs = list?.threads ?? [];

  // Gmail's threads.list doesn't return subject/snippet/headers — each
  // thread needs its own fetch (format=metadata keeps this cheap, no
  // bodies) to build the list view.
  const threads = await Promise.all(
    threadStubs.map(async (stub) => {
      const thread = (await gmailFetch(
        `/threads/${stub.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`
      )) as { id: string; snippet: string; messages: GmailMessageRow[] };

      const messages = thread.messages;
      const last = messages[messages.length - 1];
      const participants = Array.from(
        new Set(messages.map((m) => headerValue(m.payload.headers, "From") || "").filter(Boolean))
      );

      return {
        id: thread.id,
        subject: headerValue(last.payload.headers, "Subject") || "(no subject)",
        snippet: thread.snippet,
        lastMessageDate: Number(last.internalDate),
        unread: messages.some((m) => (m.labelIds ?? []).includes("UNREAD")),
        participants,
      };
    })
  );

  return threads.sort((a, b) => b.lastMessageDate - a.lastMessageDate);
}

/** One thread's full messages, oldest first (reading order). */
export async function getThreadMessages(threadId: string): Promise<EmailMessage[]> {
  const thread = (await gmailFetch(`/threads/${threadId}?format=full`)) as { messages: GmailMessageRow[] };
  return thread.messages.map(toEmailMessage).sort((a, b) => a.date - b.date);
}

export async function markThreadRead(threadId: string): Promise<void> {
  await gmailFetch(`/threads/${threadId}/modify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  });
}

export interface SendEmailInput {
  to: string;
  subject: string;
  bodyText: string;
  threadId?: string; // set when replying, to keep it in the same Gmail thread
  inReplyTo?: string; // the Message-ID header of the message being replied to
  references?: string;
}

function buildRawMessage(input: SendEmailInput): string {
  const lines = [
    `From: Radiance Laser <${RADIANCE_EMAIL_ADDRESS}>`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `MIME-Version: 1.0`,
  ];
  if (input.inReplyTo) lines.push(`In-Reply-To: ${input.inReplyTo}`);
  if (input.references) lines.push(`References: ${input.references}`);
  lines.push("", input.bodyText);
  return lines.join("\r\n");
}

export async function sendEmail(input: SendEmailInput): Promise<{ id: string; threadId: string }> {
  const raw = base64UrlEncode(buildRawMessage(input));
  const result = (await gmailFetch(`/messages/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw, ...(input.threadId ? { threadId: input.threadId } : {}) }),
  })) as { id: string; threadId: string };
  return result;
}

/** The Gmail account's own address (whichever Google account authorized
 * the connection) — used right after the OAuth callback to record who
 * connected it, and nowhere else (every send uses RADIANCE_EMAIL_ADDRESS,
 * not this). */
export async function fetchAuthorizedAccountEmail(accessToken: string): Promise<string> {
  const res = await fetch(`${GMAIL_API_BASE}/profile`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Failed to fetch Gmail profile (${res.status}): ${raw}`);
  return (JSON.parse(raw) as { emailAddress: string }).emailAddress;
}
