"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { getWhatsAppConnection } from "@/lib/db/whatsapp";
import {
  getClinicConversations,
  getConversationMessages,
  recordOutboundMessage,
  markConversationRead,
} from "@/lib/db/whatsappConversations";
import { activeProvider } from "@/lib/whatsapp/activeProvider";
import type { WhatsAppMessage } from "@/types";

async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  return session;
}

/** Sends a free-form reply inside an existing conversation's open window.
 * Open to any signed-in staff, same as replying to a patient is an
 * everyday front-desk/clinical task, not an owner-only setting. */
export async function sendReplyAction(
  conversationId: string,
  text: string
): Promise<{ message: WhatsAppMessage } | { error: string }> {
  try {
    const session = await requireSession();
    const trimmed = text.trim();
    if (!trimmed) return { error: "Type a message first." };

    const connection = await getWhatsAppConnection(session.clinicId);
    if (!connection?.accessToken) return { error: "WhatsApp isn't connected. Set it up in Communication first." };

    const conversations = await getClinicConversations(session.clinicId);
    const conversation = conversations.find((c) => c.id === conversationId);
    if (!conversation) return { error: "Conversation not found." };

    const result = await activeProvider.sendFreeText(connection, conversation.phoneNumber, trimmed);
    const message = await recordOutboundMessage(session.clinicId, conversationId, trimmed, "sent", {
      providerMessageId: result.providerMessageId,
    });

    revalidatePath("/dashboard/inbox");
    return { message };
  } catch (err) {
    console.error("Failed to send WhatsApp reply:", err);
    return { error: err instanceof Error ? err.message : "Couldn't send this reply. Please try again." };
  }
}

/** Loads one conversation's messages on selection, rather than sending
 * every conversation's full history down on the initial page load. */
export async function loadConversationMessagesAction(conversationId: string): Promise<WhatsAppMessage[]> {
  const session = await requireSession();
  return getConversationMessages(session.clinicId, conversationId);
}

export async function markConversationReadAction(conversationId: string): Promise<{ error?: string }> {
  try {
    const session = await requireSession();
    await markConversationRead(session.clinicId, conversationId);
    revalidatePath("/dashboard/inbox");
    return {};
  } catch (err) {
    console.error("Failed to mark conversation read:", err);
    return { error: "Couldn't update this conversation." };
  }
}
