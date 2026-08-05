"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { adminDb } from "@/lib/firebase/admin";
import {
  startManagedConnection,
  validateByoCredentials,
  submitTemplate as submitTemplateToGupshup,
} from "@/lib/whatsapp/gupshupClient";
import { getWhatsAppConnection } from "@/lib/firestore/whatsapp";
import type { MessageTemplateCategory, TemplateButton, WhatsAppConnection } from "@/types";

async function requireOwner() {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  if (session.role !== "owner") throw new Error("Only the clinic owner can do this.");
  return session;
}

/** Step 1 of the managed flow — returns the embedded-signup URL for the
 * Settings UI to open in a popup. Step 2 (persisting the resulting
 * connection) happens in completeManagedConnectionAction below, called once
 * the popup posts back the appId Gupshup issued. */
export async function beginManagedConnectionAction(): Promise<{ signupUrl?: string; error?: string }> {
  try {
    const session = await requireOwner();
    const { signupUrl } = await startManagedConnection(session.clinicId);
    return { signupUrl };
  } catch (err) {
    console.error("Failed to start managed WhatsApp connection:", err);
    return { error: err instanceof Error ? err.message : "Couldn't start the connection. Please try again." };
  }
}

export async function completeManagedConnectionAction(
  gupshupAppId: string,
  displayPhoneNumber: string
): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();
    const connection: WhatsAppConnection = {
      id: session.clinicId,
      clinicId: session.clinicId,
      mode: "managed",
      status: "connected",
      gupshupAppId,
      displayPhoneNumber,
      connectedAt: Date.now(),
      updatedAt: Date.now(),
    };
    await adminDb().collection("whatsappConnections").doc(session.clinicId).set(connection);
    revalidatePath("/dashboard/settings");
    return {};
  } catch (err) {
    console.error("Failed to complete managed WhatsApp connection:", err);
    return { error: "Couldn't save the connection. Please try again." };
  }
}

export async function connectByoAction(appId: string, apiKey: string): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();
    const { displayPhoneNumber } = await validateByoCredentials(appId, apiKey);

    const connection: WhatsAppConnection = {
      id: session.clinicId,
      clinicId: session.clinicId,
      mode: "byo",
      status: "connected",
      gupshupAppId: appId,
      byoApiKey: apiKey,
      displayPhoneNumber,
      connectedAt: Date.now(),
      updatedAt: Date.now(),
    };
    await adminDb().collection("whatsappConnections").doc(session.clinicId).set(connection);
    revalidatePath("/dashboard/settings");
    return {};
  } catch (err) {
    console.error("Failed to connect BYO WhatsApp account:", err);
    return { error: err instanceof Error ? err.message : "Couldn't connect this account. Please try again." };
  }
}

export async function disconnectWhatsAppAction(): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();
    await adminDb().collection("whatsappConnections").doc(session.clinicId).delete();
    revalidatePath("/dashboard/settings");
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
  body: string;
  variableLabels: string[];
  buttons: TemplateButton[];
}): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();
    const connection = await getWhatsAppConnection(session.clinicId);
    if (!connection || connection.status !== "connected") {
      return { error: "Connect WhatsApp before creating templates." };
    }

    const now = Date.now();
    const docRef = adminDb().collection("messageTemplates").doc();
    const { gupshupTemplateId } = await submitTemplateToGupshup(connection, input);

    await docRef.set({
      clinicId: session.clinicId,
      ...input,
      approvalStatus: "pending",
      gupshupTemplateId,
      createdAt: now,
      updatedAt: now,
    });
    revalidatePath("/dashboard/settings");
    return {};
  } catch (err) {
    console.error("Failed to create message template:", err);
    return { error: err instanceof Error ? err.message : "Couldn't submit this template. Please try again." };
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
    revalidatePath("/dashboard/settings");
    return {};
  } catch (err) {
    console.error("Failed to delete message template:", err);
    return { error: "Couldn't delete this template. Please try again." };
  }
}
