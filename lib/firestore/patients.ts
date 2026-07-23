import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { normalizePhone } from "@/lib/phone";
import type { Patient, SkinType } from "@/types";

const PATIENT_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

function generatePatientCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += PATIENT_CODE_CHARS.charAt(Math.floor(Math.random() * PATIENT_CODE_CHARS.length));
  }
  return `PT-${code}`;
}

export async function getPatients(clinicId: string): Promise<Patient[]> {
  // This where+orderBy combo needs a composite index. Firestore will throw
  // a helpful error with a direct "create this index" link the first time
  // you run it — click it, or add it manually in Firebase Console →
  // Firestore → Indexes (fields: clinicId Ascending, createdAt Descending).
  const snap = await adminDb()
    .collection("patients")
    .where("clinicId", "==", clinicId)
    .orderBy("createdAt", "desc")
    .get();

  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Patient);
}

export async function getPatient(clinicId: string, patientId: string): Promise<Patient | null> {
  const snap = await adminDb().collection("patients").doc(patientId).get();
  if (!snap.exists) return null;

  const data = snap.data();
  // Belt-and-suspenders tenant check even though Firestore rules already
  // enforce this — never trust a document ID alone to imply ownership.
  if (data?.clinicId !== clinicId) return null;

  return { id: snap.id, ...data } as Patient;
}

/** Finds an existing patient with the same phone number (digits-only
 * comparison — see lib/phone.ts), so the create/edit forms can warn before
 * quietly creating a duplicate record for someone who's already a patient.
 * Pass excludePatientId when checking from an edit form, so a patient's own
 * unchanged phone number doesn't flag itself as a duplicate. */
export async function findPatientByPhone(
  clinicId: string,
  phone: string,
  excludePatientId?: string
): Promise<Patient | null> {
  const target = normalizePhone(phone);
  if (!target) return null;
  const patients = await getPatients(clinicId);
  return (
    patients.find((p) => p.id !== excludePatientId && normalizePhone(p.phone) === target) || null
  );
}

export interface CreatePatientInput {
  clinicId: string;
  name: string;
  phone: string;
  email?: string;
  age?: number;
  gender?: string;
  address?: string;
  skinType?: SkinType;
  contraindications?: string;
}

export async function createPatient(input: CreatePatientInput): Promise<string> {
  const docRef = adminDb().collection("patients").doc();

  const patient: Omit<Patient, "id"> = {
    clinicId: input.clinicId,
    name: input.name,
    phone: input.phone,
    patientCode: generatePatientCode(),
    createdAt: Date.now(),
    ...(input.email ? { email: input.email } : {}),
    ...(input.age !== undefined ? { age: input.age } : {}),
    ...(input.gender ? { gender: input.gender } : {}),
    ...(input.address ? { address: input.address } : {}),
    ...(input.skinType ? { skinType: input.skinType } : {}),
    ...(input.contraindications ? { contraindications: input.contraindications } : {}),
  };

  await docRef.set(patient);
  return docRef.id;
}

export interface UpdatePatientInput {
  name: string;
  phone: string;
  email?: string;
  age?: number;
  gender?: string;
  address?: string;
  skinType?: SkinType;
  contraindications?: string;
}

/** Fixing a typo shouldn't mean deleting and recreating a patient (which
 * would orphan all their visits/appointments/photos/etc.) — this is the
 * only way to correct a patient's own record once created. Every optional
 * field is named explicitly with FieldValue.delete() as the fallback, so
 * clearing one (e.g. removing a skin type) actually removes it instead of
 * leaving the old value behind, same reasoning as deleteField() elsewhere
 * in the client-side forms. */
export async function updatePatient(
  clinicId: string,
  patientId: string,
  input: UpdatePatientInput
): Promise<void> {
  const docRef = adminDb().collection("patients").doc(patientId);
  const snap = await docRef.get();
  if (!snap.exists || snap.data()?.clinicId !== clinicId) {
    throw new Error("Patient not found.");
  }

  const update: Record<string, unknown> = {
    name: input.name,
    phone: input.phone,
    email: input.email ?? FieldValue.delete(),
    age: input.age ?? FieldValue.delete(),
    gender: input.gender ?? FieldValue.delete(),
    address: input.address ?? FieldValue.delete(),
    skinType: input.skinType ?? FieldValue.delete(),
    contraindications: input.contraindications ?? FieldValue.delete(),
  };

  await docRef.update(update);
}
