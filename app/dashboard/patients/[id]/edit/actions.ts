"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPatient, updatePatient, findPatientByPhone, checkPatientRetentionFloor, erasePatient } from "@/lib/db/patients";
import { recordAuditEvent } from "@/lib/db/auditLog";
import { isValidPhone } from "@/lib/phone";
import type { SkinType } from "@/types";

export interface UpdatePatientState {
  error?: string;
  duplicate?: { id: string; name: string; phone: string };
}

export async function updatePatientAction(
  patientId: string,
  _prevState: UpdatePatientState,
  formData: FormData
): Promise<UpdatePatientState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const patient = await getPatient(session.clinicId, patientId);
  if (!patient) return { error: "Patient not found." };

  const name = (formData.get("name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const confirmDuplicate = formData.get("confirmDuplicate") === "1";

  if (!name) return { error: "Name is required." };
  if (!phone) return { error: "Contact number is required." };
  if (!isValidPhone(phone)) {
    return { error: "That doesn't look like a valid contact number — check the digits and try again." };
  }

  if (!confirmDuplicate) {
    const existing = await findPatientByPhone(session.clinicId, phone, patientId);
    if (existing) {
      return { duplicate: { id: existing.id, name: existing.name, phone: existing.phone } };
    }
  }

  const email = (formData.get("email") as string)?.trim();
  const ageRaw = (formData.get("age") as string)?.trim();
  const gender = (formData.get("gender") as string)?.trim();
  const address = (formData.get("address") as string)?.trim();
  const skinType = (formData.get("skinType") as string)?.trim();
  const contraindications = (formData.get("contraindications") as string)?.trim();

  try {
    await updatePatient(session.clinicId, patientId, {
      name,
      phone,
      ...(email ? { email } : {}),
      ...(ageRaw ? { age: Number(ageRaw) } : {}),
      ...(gender ? { gender } : {}),
      ...(address ? { address } : {}),
      ...(skinType ? { skinType: skinType as SkinType } : {}),
      ...(contraindications ? { contraindications } : {}),
    });
  } catch (err) {
    console.error("Failed to update patient:", err);
    return { error: "Something went wrong saving these changes. Please try again." };
  }

  await recordAuditEvent(session, { action: "patient.update", targetType: "Patient", targetId: patientId });

  redirect(`/dashboard/patients/${patientId}`);
}

export interface EraseState {
  error?: string;
}

/**
 * DPDP Act §12 right-to-erasure, gated by the IMC's 3-year record-retention
 * floor (see lib/db/patients.ts checkPatientRetentionFloor) — a patient
 * whose most recent visit is still inside that window can't lawfully be
 * erased yet, regardless of who asks. Owner-only, same as every other
 * irreversible action in this app (deleteClinicAction, etc.).
 */
export async function erasePatientAction(patientId: string, _prevState: EraseState, formData: FormData): Promise<EraseState> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "owner") return { error: "Only the clinic owner can erase a patient's data." };

  const patient = await getPatient(session.clinicId, patientId);
  if (!patient) return { error: "Patient not found." };

  const confirmedName = (formData.get("confirmName") as string)?.trim();
  if (confirmedName !== patient.name) {
    return { error: "Type the patient's exact name to confirm erasure." };
  }

  const retention = await checkPatientRetentionFloor(session.clinicId, patientId);
  if (!retention.eligible) {
    const eligibleOn = new Date(retention.retentionFloorEndsAt).toLocaleDateString("en-IN");
    return {
      error: `This record is still within the legally required 3-year retention period (Indian Medical Council Regulation 1.3.1) and can't be erased until ${eligibleOn}.`,
    };
  }

  try {
    await erasePatient(session.clinicId, patientId);
  } catch (err) {
    console.error("Failed to erase patient:", err);
    return { error: "Something went wrong erasing this patient. Please try again." };
  }

  await recordAuditEvent(session, {
    action: "patient.erase",
    targetType: "Patient",
    targetId: patientId,
    metadata: { patientName: patient.name, retentionFloorEndsAt: retention.retentionFloorEndsAt },
  });

  redirect("/dashboard/patients");
}
