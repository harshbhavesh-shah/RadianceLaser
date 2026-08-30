"use server";

import { getSession } from "@/lib/session";
import { getPatient } from "@/lib/db/patients";
import { createPatientPhoto, deletePatientPhoto, type CreatePatientPhotoInput } from "@/lib/db/patientPhotos";
import type { PatientPhoto } from "@/types";

// Server Actions backing PatientPhotoUploadModal/PatientPhotoGallery —
// replaces their old direct Firestore client-SDK writes now that
// PatientPhoto lives in Postgres (lib/db/patientPhotos.ts). The image data
// itself (a compressed base64 data URL — see lib/imageCompression.ts) now
// travels to the server as part of this action's request body instead of a
// direct Firestore write; next.config.js raises the Server Actions body
// size limit to give it headroom.

export type CreatePatientPhotoFormInput = Omit<CreatePatientPhotoInput, "clinicId" | "uploadedByUid">;

export async function createPatientPhotoAction(
  input: CreatePatientPhotoFormInput
): Promise<{ photo: PatientPhoto } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  const patient = await getPatient(session.clinicId, input.patientId);
  if (!patient) return { error: "Patient not found." };

  try {
    const photo = await createPatientPhoto({
      clinicId: session.clinicId,
      uploadedByUid: session.uid,
      ...input,
    });
    return { photo };
  } catch (err) {
    console.error("Failed to upload photo:", err);
    return { error: "Couldn't save this photo. Please try again." };
  }
}

export async function deletePatientPhotoAction(id: string): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  try {
    await deletePatientPhoto(session.clinicId, id);
    return { ok: true };
  } catch (err) {
    console.error("Failed to delete photo:", err);
    return { error: "Couldn't delete this photo. Please try again." };
  }
}
