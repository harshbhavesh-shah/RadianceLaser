"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import {
  createNoShowFollowUp,
  updateNoShowFollowUp,
  deleteNoShowFollowUp,
  type NoShowFollowUpInput,
} from "@/lib/db/noShowFollowUps";
import { clearVisitFollowUp } from "@/lib/db/visits";
import { getClinicMessageTemplates } from "@/lib/db/messageTemplates";
import { getWhatsAppConnection } from "@/lib/db/whatsapp";
import { activeProvider } from "@/lib/whatsapp/activeProvider";
import { normalizePhone } from "@/lib/phone";
import { getClinic } from "@/lib/db/clinics";
import { getClinicTier, getEntitlements } from "@/lib/entitlements";
import type { NoShowFollowUp } from "@/types";

// Server Actions backing FollowUpFormModal's save/delete. Same
// requireOwner() pattern as app/dashboard/areas/actions.ts.

async function requireRetentionAccess() {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");

  const clinic = await getClinic(session.clinicId);
  const tier = getClinicTier(
    clinic ?? { subscriptionStatus: "active", trialEndsAt: 0, planTier: null }
  );
  if (!getEntitlements(tier).patientRetention) {
    throw new Error("Patient Retention is available on the Standard plan and above.");
  }

  return session;
}

async function requireOwner() {
  const session = await requireRetentionAccess();
  if (session.role !== "owner") throw new Error("Only the clinic owner can do this.");
  return session;
}

export async function createNoShowFollowUpAction(
  input: NoShowFollowUpInput
): Promise<{ followUp: NoShowFollowUp } | { error: string }> {
  try {
    const session = await requireOwner();
    if (!input.name.trim()) return { error: "Follow-up name is required." };
    if (!input.templateId) return { error: "Pick a message template first." };

    const followUp = await createNoShowFollowUp(session.clinicId, { ...input, name: input.name.trim() });
    revalidatePath("/dashboard/no-shows");
    return { followUp };
  } catch (err) {
    console.error("Failed to create no-show follow-up:", err);
    return { error: "Couldn't save this follow-up. Please try again." };
  }
}

export async function updateNoShowFollowUpAction(
  id: string,
  input: NoShowFollowUpInput
): Promise<{ followUp: NoShowFollowUp } | { error: string }> {
  try {
    const session = await requireOwner();
    if (!input.name.trim()) return { error: "Follow-up name is required." };
    if (!input.templateId) return { error: "Pick a message template first." };

    const followUp = await updateNoShowFollowUp(session.clinicId, id, { ...input, name: input.name.trim() });
    revalidatePath("/dashboard/no-shows");
    return { followUp };
  } catch (err) {
    console.error("Failed to update no-show follow-up:", err);
    return { error: "Couldn't save this follow-up. Please try again." };
  }
}

export async function deleteNoShowFollowUpAction(id: string): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();
    await deleteNoShowFollowUp(session.clinicId, id);
    revalidatePath("/dashboard/no-shows");
    return {};
  } catch (err) {
    console.error("Failed to delete no-show follow-up:", err);
    return { error: "Couldn't delete this follow-up. Please try again." };
  }
}

// Backs FollowUpList's "Send Follow-up Now" / "Mark Done" / "Skip" buttons
// (the Follow-Ups tab's per-visit reminders, e.g. "check for any reaction,
// confirm next session" — not the same feature as the No Show Follow-Ups
// above despite the similar name). Any signed-in staff member can act —
// same reasoning as sendReceiptMessageAction in
// app/dashboard/communication/actions.ts: a day-to-day action on a
// specific patient interaction, not an account setting.

/** Sends the visit's follow-up note to the patient over WhatsApp, using
 * the clinic's "visit_follow_up" template, then clears the follow-up so
 * it drops off the list — same as marking it done, since the reminder's
 * job (get this message to the patient) is now complete. */
export async function sendVisitFollowUpNowAction(
  visitId: string,
  patientName: string,
  patientPhone: string,
  followUpNote: string
): Promise<{ error?: string }> {
  try {
    const session = await requireRetentionAccess();
    if (!patientPhone) return { error: "This patient has no phone number on file." };

    const connection = await getWhatsAppConnection(session.clinicId);
    if (!connection || connection.status !== "connected") {
      return { error: "Connect WhatsApp in Communication settings first." };
    }
    const templates = await getClinicMessageTemplates(session.clinicId);
    const template = templates.find((t) => t.category === "visit_follow_up");
    if (!template) {
      return { error: 'No "Visit Follow-Up" template set up yet. Add one in Communication settings.' };
    }

    await activeProvider.sendTemplateMessage(
      connection,
      normalizePhone(patientPhone),
      template.name,
      [patientName, followUpNote || ""],
      template.language
    );

    await clearVisitFollowUp(session.clinicId, visitId);
    revalidatePath("/dashboard/no-shows");
    return {};
  } catch (err) {
    console.error("Failed to send visit follow-up:", err);
    return { error: err instanceof Error ? err.message : "Couldn't send this follow-up. Please try again." };
  }
}

/** "Mark Done" and "Skip" both just mean "stop showing me this reminder" —
 * there's no separate status to track between the two, only how staff
 * framed their own decision in the moment. */
export async function clearVisitFollowUpAction(visitId: string): Promise<{ error?: string }> {
  try {
    const session = await requireRetentionAccess();
    await clearVisitFollowUp(session.clinicId, visitId);
    revalidatePath("/dashboard/no-shows");
    return {};
  } catch (err) {
    console.error("Failed to clear visit follow-up:", err);
    return { error: "Couldn't update this follow-up. Please try again." };
  }
}
