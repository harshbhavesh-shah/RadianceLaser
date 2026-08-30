"use server";

import { getSession } from "@/lib/session";
import { getPatient } from "@/lib/db/patients";
import {
  createConsentFormTemplate,
  updateConsentFormTemplate,
  deleteConsentFormTemplate,
  createConsentForm,
  deleteConsentForm,
  type ConsentFormTemplateInput,
} from "@/lib/db/consentForms";
import type { ConsentForm, ConsentFormTemplate } from "@/types";

// Server Actions backing ConsentTemplateFormModal, ConsentFormSignModal,
// and ConsentFormViewModal — replaces their old direct Firestore
// client-SDK writes now that ConsentFormTemplate/ConsentForm live in
// Postgres (lib/db/consentForms.ts).

export async function createConsentFormTemplateAction(
  input: ConsentFormTemplateInput
): Promise<{ template: ConsentFormTemplate } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  try {
    const template = await createConsentFormTemplate(session.clinicId, input);
    return { template };
  } catch (err) {
    console.error("Failed to create consent template:", err);
    return { error: "Couldn't save this template. Please try again." };
  }
}

export async function updateConsentFormTemplateAction(
  id: string,
  input: ConsentFormTemplateInput
): Promise<{ template: ConsentFormTemplate } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  try {
    const template = await updateConsentFormTemplate(session.clinicId, id, input);
    return { template };
  } catch (err) {
    console.error("Failed to update consent template:", err);
    return { error: "Couldn't save this template. Please try again." };
  }
}

export async function deleteConsentFormTemplateAction(id: string): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  try {
    await deleteConsentFormTemplate(session.clinicId, id);
    return { ok: true };
  } catch (err) {
    console.error("Failed to delete consent template:", err);
    return { error: "Couldn't delete this template. Please try again." };
  }
}

export interface SignConsentFormInput {
  patientId: string;
  templateId: string;
  templateTitle: string;
  visitId?: string;
  renderedBody: string;
  signatureDataUrl: string;
  signedByName: string;
  // Session carries no display name (see lib/db/staff.ts) — the caller
  // already has the signed-in staff member's name (PatientConsentForms
  // threads it through as currentName, resolved server-side one level up),
  // so it's passed straight through rather than re-derived here.
  witnessName: string;
}

export async function createConsentFormAction(
  input: SignConsentFormInput
): Promise<{ form: ConsentForm } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  const patient = await getPatient(session.clinicId, input.patientId);
  if (!patient) return { error: "Patient not found." };

  try {
    const form = await createConsentForm({
      clinicId: session.clinicId,
      ...input,
      witnessUid: session.uid,
    });
    return { form };
  } catch (err) {
    console.error("Failed to save consent form:", err);
    return { error: "Couldn't save this consent form. Please try again." };
  }
}

export async function deleteConsentFormAction(id: string): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  try {
    await deleteConsentForm(session.clinicId, id);
    return { ok: true };
  } catch (err) {
    console.error("Failed to delete consent form:", err);
    return { error: "Couldn't delete this form. Please try again." };
  }
}
