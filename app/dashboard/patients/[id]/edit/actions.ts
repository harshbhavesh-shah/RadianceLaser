"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPatient, updatePatient, findPatientByPhone } from "@/lib/firestore/patients";
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

  redirect(`/dashboard/patients/${patientId}`);
}
