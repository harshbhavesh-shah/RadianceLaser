"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/session";
import { getEmailConnection, deleteEmailConnection } from "@/lib/db/emailConnection";
import {
  listThreads,
  getThreadMessages,
  markThreadRead,
  sendEmail,
  type EmailThreadSummary,
  type EmailMessage,
} from "@/lib/gmail/client";
import type { AdminSession } from "@/types";

async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
  return session;
}

export async function getThreadsAction(): Promise<{ threads?: EmailThreadSummary[]; error?: string }> {
  try {
    await requireSuperAdmin();
    const threads = await listThreads();
    return { threads };
  } catch (err) {
    console.error("Failed to list email threads:", err);
    return { error: err instanceof Error ? err.message : "Couldn't load the inbox. Please try again." };
  }
}

export async function getThreadMessagesAction(threadId: string): Promise<{ messages?: EmailMessage[]; error?: string }> {
  try {
    await requireSuperAdmin();
    const messages = await getThreadMessages(threadId);
    // Best-effort — a stale/removed thread shouldn't block the messages
    // from showing, just log and move on.
    await markThreadRead(threadId).catch((err) => console.error("Failed to mark thread read:", err));
    return { messages };
  } catch (err) {
    console.error("Failed to load email thread:", err);
    return { error: err instanceof Error ? err.message : "Couldn't load this conversation. Please try again." };
  }
}

export interface SendEmailActionInput {
  to: string;
  subject: string;
  bodyText: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}

export async function sendEmailAction(input: SendEmailActionInput): Promise<{ ok?: true; error?: string }> {
  try {
    await requireSuperAdmin();

    if (!input.to.trim()) return { error: "Enter a recipient." };
    if (!input.subject.trim()) return { error: "Enter a subject." };
    if (!input.bodyText.trim()) return { error: "Write a message first." };

    await sendEmail(input);
    revalidatePath("/admin/email");
    return { ok: true };
  } catch (err) {
    console.error("Failed to send email:", err);
    return { error: err instanceof Error ? err.message : "Couldn't send this email. Please try again." };
  }
}

export async function disconnectEmailAction(): Promise<{ error?: string }> {
  try {
    await requireSuperAdmin();
    await deleteEmailConnection();
    revalidatePath("/admin/email");
    return {};
  } catch (err) {
    console.error("Failed to disconnect Gmail:", err);
    return { error: "Couldn't disconnect. Please try again." };
  }
}

export async function getEmailConnectionStatusAction(): Promise<{ connected: boolean; gmailAccount?: string }> {
  await requireSuperAdmin();
  const connection = await getEmailConnection();
  return connection ? { connected: true, gmailAccount: connection.gmailAccount } : { connected: false };
}
