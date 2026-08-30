"use server";

import { getSession } from "@/lib/session";
import { getPatient } from "@/lib/db/patients";
import { createVisit, updateVisit, deleteVisit } from "@/lib/db/visits";
import type { PaymentMethod, SessionType, VisitAreaEntry } from "@/types";

// Server Actions backing VisitFormModal's save/delete — replaces that
// component's old direct Firestore client-SDK writes now that Visit lives
// in Postgres (lib/db/visits.ts), which only server code can reach.

export interface VisitFormFields {
  date: string;
  fields: Record<string, string | number>;
  areas: VisitAreaEntry[];
  packageId?: string;
  paymentMethod?: PaymentMethod;
  followUpDate?: string;
  followUpNote?: string;
  machineId?: string;
  performedByUid?: string;
  performedByName?: string;
  durationMinutes?: number;
}

export async function createVisitAction(
  patientId: string,
  sessionType: SessionType,
  appointmentId: string | undefined,
  input: VisitFormFields
): Promise<{ id: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  const patient = await getPatient(session.clinicId, patientId);
  if (!patient) return { error: "Patient not found." };

  try {
    const id = await createVisit({
      clinicId: session.clinicId,
      patientId,
      sessionType,
      appointmentId,
      ...input,
    });
    return { id };
  } catch (err) {
    console.error("Failed to create visit:", err);
    return { error: "Couldn't save this visit. Please try again." };
  }
}

export async function updateVisitAction(
  visitId: string,
  input: VisitFormFields
): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  try {
    await updateVisit(session.clinicId, visitId, input);
    return { ok: true };
  } catch (err) {
    console.error("Failed to update visit:", err);
    return { error: "Couldn't save this visit. Please try again." };
  }
}

export async function deleteVisitAction(visitId: string): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  try {
    await deleteVisit(session.clinicId, visitId);
    return { ok: true };
  } catch (err) {
    console.error("Failed to delete visit:", err);
    return { error: "Couldn't delete this visit. Please try again." };
  }
}
