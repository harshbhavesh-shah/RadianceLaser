"use server";

import { getSession } from "@/lib/session";
import { createPatient, findPatientByPhone, getPatient } from "@/lib/db/patients";
import { isValidPhone } from "@/lib/phone";
import type { Patient } from "@/types";

export interface QuickCreatePatientResult {
  patient?: Patient;
  error?: string;
  duplicate?: { id: string; name: string; phone: string };
}

/** The stripped-down version of app/dashboard/patients/new/actions.ts
 * createPatientAction — name and phone only, called from
 * AppointmentFormModal's "patient not found" inline form so booking someone
 * new doesn't require leaving the calendar to visit the full New Patient
 * page first. Same duplicate-phone guard as the full form, just returning
 * the created patient directly instead of redirecting. */
export async function quickCreatePatientAction(
  name: string,
  phone: string,
  confirmDuplicate = false
): Promise<QuickCreatePatientResult> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  if (!trimmedName) return { error: "Name is required." };
  if (!trimmedPhone) return { error: "Contact number is required." };
  if (!isValidPhone(trimmedPhone)) {
    return { error: "That doesn't look like a valid contact number — check the digits and try again." };
  }

  if (!confirmDuplicate) {
    const existing = await findPatientByPhone(session.clinicId, trimmedPhone);
    if (existing) {
      return { duplicate: { id: existing.id, name: existing.name, phone: existing.phone } };
    }
  }

  try {
    const patientId = await createPatient({ clinicId: session.clinicId, name: trimmedName, phone: trimmedPhone });
    const patient = await getPatient(session.clinicId, patientId);
    if (!patient) throw new Error("Patient was created but couldn't be read back.");
    return { patient };
  } catch (err) {
    console.error("Failed to quick-create patient:", err);
    return { error: "Something went wrong saving this patient. Please try again." };
  }
}
