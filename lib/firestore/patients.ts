import "server-only";
import { adminDb } from "@/lib/firebase/admin";
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
