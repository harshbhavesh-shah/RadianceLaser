"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getSession } from "@/lib/session";
import { activeProvider } from "@/lib/whatsapp/activeProvider";
import { sendSms } from "@/lib/smsgate/client";
import { getWhatsAppConnection, upsertWhatsAppConnection, deleteWhatsAppConnection } from "@/lib/db/whatsapp";
import { getClinicMessageTemplates, createMessageTemplate, deleteMessageTemplate } from "@/lib/db/messageTemplates";
import { getReceipt } from "@/lib/db/receipts";
import { getClinic, updateMessagingSettings, clinicCacheTag, type MessagingSettingsInput } from "@/lib/db/clinics";
import { normalizePhone } from "@/lib/phone";
import { TEMPLATE_VARIABLE_LABELS } from "@/types";
import type { MessageTemplate, MessageTemplateCategory } from "@/types";

async function requireOwner() {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  if (session.role !== "owner") throw new Error("Only the clinic owner can do this.");
  return session;
}

/** Connects (or re-connects/updates) this clinic's Meta WhatsApp Cloud API
 * credentials. There's no separate validation endpoint to check these
 * against before saving — a typo'd access token only surfaces on the first
 * real send (or on "Send Test" below).
 *
 * `accessToken` and `appSecret` are both optional on an edit — leaving
 * either blank in the form keeps whatever's already saved rather than
 * forcing both to be retyped every time the phone number id or WABA id
 * changes. */
export async function connectWhatsAppAction(
  phoneNumberId: string,
  accessToken: string,
  appSecret: string,
  wabaId: string,
  phoneNumber: string
): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();
    if (!phoneNumberId.trim()) {
      return { error: "Phone Number ID is required." };
    }

    const existing = await getWhatsAppConnection(session.clinicId);

    let finalAccessToken = accessToken.trim();
    if (!finalAccessToken) {
      finalAccessToken = existing?.accessToken || "";
      if (!finalAccessToken) return { error: "Access token is required." };
    }

    let finalAppSecret = appSecret.trim();
    if (!finalAppSecret) {
      finalAppSecret = existing?.appSecret || "";
      if (!finalAppSecret) return { error: "App secret is required." };
    }

    await upsertWhatsAppConnection(session.clinicId, {
      phoneNumberId: phoneNumberId.trim(),
      accessToken: finalAccessToken,
      appSecret: finalAppSecret,
      wabaId: wabaId.trim() || undefined,
      phoneNumber: phoneNumber.trim() || undefined,
    });
    revalidatePath("/dashboard/communication");
    return {};
  } catch (err) {
    console.error("Failed to connect Meta WhatsApp Cloud API:", err);
    return { error: err instanceof Error ? err.message : "Couldn't save this connection. Please try again." };
  }
}

export async function disconnectWhatsAppAction(): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();
    await deleteWhatsAppConnection(session.clinicId);
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
  language: string;
  variableLabels: string[];
  bodyPreview?: string;
}): Promise<{ template?: MessageTemplate; error?: string }> {
  try {
    const session = await requireOwner();
    if (!input.name.trim()) return { error: "Template name is required." };
    if (!input.language.trim()) return { error: "Language is required." };

    // The three built-in categories fill their variables automatically from
    // real data (see TEMPLATE_VARIABLE_LABELS) — the labels aren't staff-
    // editable, so ignore whatever came in and use the fixed set instead.
    // Only "custom" keeps whatever labels were actually typed.
    const variableLabels =
      input.category === "custom" ? input.variableLabels : TEMPLATE_VARIABLE_LABELS[input.category];

    const template = await createMessageTemplate({
      clinicId: session.clinicId,
      name: input.name.trim(),
      category: input.category,
      language: input.language.trim(),
      variableLabels,
      bodyPreview: input.bodyPreview?.trim() || undefined,
    });
    revalidatePath("/dashboard/communication");
    return { template };
  } catch (err) {
    console.error("Failed to create message template:", err);
    return { error: "Couldn't save this template. Please try again." };
  }
}

export async function deleteTemplateAction(templateId: string): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();
    await deleteMessageTemplate(session.clinicId, templateId);
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

/** Sends a real WhatsApp message to a phone number of the owner's choosing,
 * using one of the clinic's saved templates — for verifying a Meta WhatsApp
 * Cloud API connection actually works (right credentials, right template
 * name/language/approval) before relying on it for real patients. Returns
 * Meta's raw response body on success as visible confirmation of what was
 * actually sent. */
export async function sendTestMessageAction(
  templateId: string,
  phone: string,
  params: string[]
): Promise<{ raw?: string; error?: string }> {
  try {
    const session = await requireOwner();

    const connection = await getWhatsAppConnection(session.clinicId);
    if (!connection || connection.status !== "connected") {
      return { error: "Connect WhatsApp first." };
    }

    const templates = await getClinicMessageTemplates(session.clinicId);
    const template = templates.find((t) => t.id === templateId);
    if (!template) return { error: "Template not found." };

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) return { error: "Enter a phone number to send to." };

    const { raw } = await activeProvider.sendTemplateMessage(
      connection,
      normalizedPhone,
      template.name,
      params,
      template.language
    );
    return { raw };
  } catch (err) {
    console.error("Failed to send test WhatsApp message:", err);
    return { error: err instanceof Error ? err.message : "Couldn't send this message. Please try again." };
  }
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

    await activeProvider.sendTemplateMessage(
      connection,
      phone,
      template.name,
      [receipt.patientName, receipt.receiptNumber, formatCurrency(receipt.amount)],
      template.language
    );
    return {};
  } catch (err) {
    console.error("Failed to send receipt message:", err);
    return { error: err instanceof Error ? err.message : "Couldn't send this receipt. Please try again." };
  }
}

/** Settings > Communication's reminder/feedback-survey toggles — see
 * app/api/cron/send-scheduled-messages, which is what actually acts on
 * these once saved. */
export async function updateMessagingSettingsAction(input: MessagingSettingsInput): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();

    if (input.reminderHoursBefore < 1 || input.reminderHoursBefore > 168) {
      return { error: "Reminder timing must be between 1 hour and 7 days." };
    }
    if (input.feedbackSurveyDelayHours < 1 || input.feedbackSurveyDelayHours > 72) {
      return { error: "Feedback survey timing must be between 1 and 72 hours." };
    }

    await updateMessagingSettings(session.clinicId, input);
    revalidateTag(clinicCacheTag(session.clinicId));
    revalidatePath("/dashboard/communication");
    return {};
  } catch (err) {
    console.error("Failed to update messaging settings:", err);
    return { error: "Couldn't save these settings. Please try again." };
  }
}
