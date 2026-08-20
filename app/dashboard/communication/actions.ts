"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { adminDb } from "@/lib/firebase/admin";
import { sendTemplateMessage } from "@/lib/bhashsms/client";
import { sendSms } from "@/lib/smsgate/client";
import { getWhatsAppConnection, getClinicMessageTemplates } from "@/lib/firestore/whatsapp";
import { getReceipt } from "@/lib/firestore/receipts";
import { getClinic } from "@/lib/firestore/clinics";
import { normalizePhone } from "@/lib/phone";
import { TEMPLATE_VARIABLE_LABELS } from "@/types";
import type { MessageTemplate, MessageTemplateCategory } from "@/types";

async function requireOwner() {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  if (session.role !== "owner") throw new Error("Only the clinic owner can do this.");
  return session;
}

/** Connects (or re-connects/updates) this clinic's BhashSMS WhatsApp
 * credentials. Unlike the old Gupshup BYO flow, there's no separate
 * validation endpoint to check these against before saving — BhashSMS's API
 * (as supplied) is just the send call itself, so a typo'd password only
 * surfaces on the first real send.
 *
 * `bhashPass` is optional on an edit — leaving it blank in the form keeps
 * whatever password is already saved rather than forcing it to be retyped
 * every time the username or sender id changes. */
export async function connectWhatsAppAction(
  bhashUser: string,
  bhashPass: string,
  senderId: string
): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();
    if (!bhashUser.trim() || !senderId.trim()) {
      return { error: "Username and sender id are required." };
    }

    let finalPass = bhashPass.trim();
    if (!finalPass) {
      const existing = await getWhatsAppConnection(session.clinicId);
      finalPass = existing?.bhashPass || "";
      if (!finalPass) return { error: "Password is required." };
    }

    await adminDb()
      .collection("whatsappConnections")
      .doc(session.clinicId)
      .set({
        id: session.clinicId,
        clinicId: session.clinicId,
        status: "connected",
        bhashUser: bhashUser.trim(),
        bhashPass: finalPass,
        senderId: senderId.trim(),
        connectedAt: Date.now(),
        updatedAt: Date.now(),
      });
    revalidatePath("/dashboard/communication");
    return {};
  } catch (err) {
    console.error("Failed to connect BhashSMS WhatsApp:", err);
    return { error: err instanceof Error ? err.message : "Couldn't save this connection. Please try again." };
  }
}

export async function disconnectWhatsAppAction(): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();
    await adminDb().collection("whatsappConnections").doc(session.clinicId).delete();
    revalidatePath("/dashboard/communication");
    return {};
  } catch (err) {
    console.error("Failed to disconnect WhatsApp:", err);
    return { error: "Couldn't disconnect. Please try again." };
  }
}

export async function createTemplateAction(input: {
  name: string;
  category: MessageTemplateCategory;
  variableLabels: string[];
  bodyPreview?: string;
}): Promise<{ template?: MessageTemplate; error?: string }> {
  try {
    const session = await requireOwner();
    if (!input.name.trim()) return { error: "Template name is required." };

    // The three built-in categories fill their variables automatically from
    // real data (see TEMPLATE_VARIABLE_LABELS) — the labels aren't staff-
    // editable, so ignore whatever came in and use the fixed set instead.
    // Only "custom" keeps whatever labels were actually typed.
    const variableLabels =
      input.category === "custom" ? input.variableLabels : TEMPLATE_VARIABLE_LABELS[input.category];

    const now = Date.now();
    const docData = {
      clinicId: session.clinicId,
      name: input.name.trim(),
      category: input.category,
      variableLabels,
      ...(input.bodyPreview?.trim() ? { bodyPreview: input.bodyPreview.trim() } : {}),
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await adminDb().collection("messageTemplates").add(docData);
    revalidatePath("/dashboard/communication");
    return { template: { id: docRef.id, ...docData } };
  } catch (err) {
    console.error("Failed to create message template:", err);
    return { error: "Couldn't save this template. Please try again." };
  }
}

export async function deleteTemplateAction(templateId: string): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();
    const doc = await adminDb().collection("messageTemplates").doc(templateId).get();
    if (!doc.exists || doc.data()?.clinicId !== session.clinicId) {
      throw new Error("Template not found.");
    }
    await doc.ref.delete();
    revalidatePath("/dashboard/communication");
    return {};
  } catch (err) {
    console.error("Failed to delete message template:", err);
    return { error: "Couldn't delete this template. Please try again." };
  }
}

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/** Sends a receipt to the patient over WhatsApp (using the clinic's
 * "receipt_sent" template, variables filled in the fixed order documented
 * on TEMPLATE_VARIABLE_LABELS) or plain SMS (free text, no template
 * needed). Any staff member can send — not owner-only, since this is a
 * day-to-day action on a specific patient interaction, not an account
 * setting. */
export async function sendReceiptMessageAction(
  receiptId: string,
  channel: "whatsapp" | "sms"
): Promise<{ error?: string }> {
  try {
    const session = await getSession();
    if (!session) throw new Error("Not signed in.");

    const receipt = await getReceipt(session.clinicId, receiptId);
    if (!receipt) return { error: "Receipt not found." };
    if (!receipt.patientPhone) return { error: "This patient has no phone number on file." };
    const phone = normalizePhone(receipt.patientPhone);

    if (channel === "sms") {
      const clinic = await getClinic(session.clinicId);
      const message =
        `Receipt ${receipt.receiptNumber} for ${receipt.patientName}: ${formatCurrency(receipt.amount)}. ` +
        `Thank you for visiting ${clinic?.name || "us"}.`;
      await sendSms(phone, message);
      return {};
    }

    const connection = await getWhatsAppConnection(session.clinicId);
    if (!connection || connection.status !== "connected") {
      return { error: "Connect WhatsApp in Communication settings first." };
    }
    const templates = await getClinicMessageTemplates(session.clinicId);
    const template = templates.find((t) => t.category === "receipt_sent");
    if (!template) {
      return { error: "No \"Receipt Sent\" template set up yet — add one in Communication settings." };
    }

    await sendTemplateMessage(connection, phone, template.name, [
      receipt.patientName,
      receipt.receiptNumber,
      formatCurrency(receipt.amount),
    ]);
    return {};
  } catch (err) {
    console.error("Failed to send receipt message:", err);
    return { error: err instanceof Error ? err.message : "Couldn't send this receipt. Please try again." };
  }
}
