"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createPatient } from "@/lib/firestore/patients";
import type { SkinType } from "@/types";

export interface CreatePatientState {
  error?: string;
}

export async function createPatientAction(
  _prevState: CreatePatientState,
  formData: FormData
): Promise<CreatePatientState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const name = (formData.get("name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();

  if (!name) return { error: "Name is required." };
  if (!phone) return { error: "Contact number is required." };

  const email = (formData.get("email") as string)?.trim();
  const ageRaw = (formData.get("age") as string)?.trim();
  const gender = (formData.get("gender") as string)?.trim();
  const address = (formData.get("address") as string)?.trim();
  const skinType = (formData.get("skinType") as string)?.trim();
  const contraindications = (formData.get("contraindications") as string)?.trim();

  let patientId: string;
  try {
    patientId = await createPatient({
      clinicId: session.clinicId,
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
    console.error("Failed to create patient:", err);
    return { error: "Something went wrong saving this patient. Please try again." };
  }

  redirect(`/dashboard/patients/${patientId}`);
}
