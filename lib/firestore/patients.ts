import "server-only";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { normalizePhone } from "@/lib/phone";
import type { Patient, SkinType } from "@/types";

const PATIENT_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
const PATIENTS_PAGE_SIZE = 25;
const SEARCH_RESULT_LIMIT = 20;
const PER_FIELD_SEARCH_LIMIT = 15;

function generatePatientCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += PATIENT_CODE_CHARS.charAt(Math.floor(Math.random() * PATIENT_CODE_CHARS.length));
  }
  return `PT-${code}`;
}

/** Every patient in the clinic, in one read. Still used by call sites that
 * genuinely need the whole roster at once — pickers, name-lookup joins
 * (receipts/consent forms/analytics), and bulk import dedup — where the
 * alternative would be paginating through the same data N times over. The
 * Patients list page itself uses getPatientsPage below instead, since that's
 * the one place someone scrolls through the roster growing into the
 * thousands over a clinic's lifetime. */
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

export interface PatientsPage {
  patients: Patient[];
  /** Opaque token to pass back in as `cursor` for the next page. Null once
   * there's nothing more to load. */
  nextCursor: string | null;
}

function encodePatientsCursor(createdAt: number, id: string): string {
  return `${createdAt}_${id}`;
}

function decodePatientsCursor(cursor: string): [number, string] {
  const separatorIndex = cursor.lastIndexOf("_");
  return [Number(cursor.slice(0, separatorIndex)), cursor.slice(separatorIndex + 1)];
}

/**
 * One page of a clinic's patients, newest first — used by the Patients list
 * page so opening it never reads the entire roster, only the page actually
 * shown. Cursor-based (not offset-based) so page N stays a single cheap
 * query no matter how deep N gets, rather than re-scanning and discarding
 * everything before it.
 *
 * Ordered by createdAt then document ID as a tiebreaker: two patients
 * created in the same millisecond would otherwise make a createdAt-only
 * cursor ambiguous (the next page could skip or repeat a row at the
 * boundary). Needs a composite index (clinicId Ascending, createdAt
 * Descending, __name__ Descending) — Firestore will prompt for it with a
 * direct "create this index" link the first time this runs.
 */
export async function getPatientsPage(
  clinicId: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<PatientsPage> {
  const limit = opts.limit ?? PATIENTS_PAGE_SIZE;

  let query = adminDb()
    .collection("patients")
    .where("clinicId", "==", clinicId)
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc")
    .limit(limit);

  if (opts.cursor) {
    const [createdAt, id] = decodePatientsCursor(opts.cursor);
    query = query.startAfter(createdAt, id);
  }

  const snap = await query.get();
  const patients = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Patient);

  const lastDoc = snap.docs[snap.docs.length - 1];
  const nextCursor =
    snap.docs.length === limit && lastDoc
      ? encodePatientsCursor((lastDoc.data() as Patient).createdAt, lastDoc.id)
      : null;

  return { patients, nextCursor };
}

/**
 * Server-side patient search across name, phone, and patient code — backs
 * the Patients list search bar once the roster is too large to load and
 * filter client-side (see getPatientsPage above).
 *
 * Firestore has no substring/full-text search, so this runs three separate
 * prefix-range queries in parallel (the standard Firestore "starts with"
 * trick: `field >= q AND field < q + ''`) against nameLower,
 * phoneNormalized, and patientCode, then merges and de-dupes the results.
 * That means matches are on *prefix*, not substring — a behavior change
 * from the old client-side `.includes()` filter, but it covers the
 * realistic case of typing the start of a name, phone, or code, and is what
 * Firestore can actually do without a separate search index/service.
 *
 * Each of the three fields needs its own composite index (clinicId
 * Ascending + that field Ascending) — Firestore will prompt for each the
 * first time it runs.
 */
export async function searchPatients(clinicId: string, rawQuery: string): Promise<Patient[]> {
  const q = rawQuery.trim();
  if (!q) return [];

  const byField = (field: string, value: string) =>
    adminDb()
      .collection("patients")
      .where("clinicId", "==", clinicId)
      .orderBy(field)
      .startAt(value)
      .endAt(value + "")
      .limit(PER_FIELD_SEARCH_LIMIT)
      .get();

  const phoneDigits = normalizePhone(q);
  const queries = [byField("nameLower", q.toLowerCase()), byField("patientCode", q.toUpperCase())];
  if (phoneDigits) queries.push(byField("phoneNormalized", phoneDigits));

  const snapshots = await Promise.all(queries);

  const byId = new Map<string, Patient>();
  for (const snap of snapshots) {
    for (const doc of snap.docs) {
      if (!byId.has(doc.id)) byId.set(doc.id, { id: doc.id, ...doc.data() } as Patient);
    }
  }

  return Array.from(byId.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, SEARCH_RESULT_LIMIT);
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
 * unchanged phone number doesn't flag itself as a duplicate.
 *
 * Queries the indexed phoneNormalized field rather than loading every
 * patient in the clinic — this needs a composite index (fields: clinicId
 * Ascending, phoneNormalized Ascending). Firestore will throw a helpful
 * "create this index" link the first time this query runs if it's missing. */
export async function findPatientByPhone(
  clinicId: string,
  phone: string,
  excludePatientId?: string
): Promise<Patient | null> {
  const target = normalizePhone(phone);
  if (!target) return null;

  const snap = await adminDb()
    .collection("patients")
    .where("clinicId", "==", clinicId)
    .where("phoneNormalized", "==", target)
    .get();

  const match = snap.docs.find((doc) => doc.id !== excludePatientId);
  return match ? ({ id: match.id, ...match.data() } as Patient) : null;
}

export interface CreatePatientInput {
  clinicId: string;
  name: string;
  phone: string;
  /** Lets an import (or, in principle, any caller) supply the clinic's own
   * existing patient ID/MRN instead of generating a fresh "PT-XXXXXX" code —
   * clinics migrating records often need the new system to keep matching
   * their old one. Falls back to the auto-generated code when omitted. */
  patientCode?: string;
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
    phoneNormalized: normalizePhone(input.phone),
    nameLower: input.name.toLowerCase(),
    patientCode: input.patientCode?.trim() || generatePatientCode(),
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
    phoneNormalized: normalizePhone(input.phone),
    nameLower: input.name.toLowerCase(),
    email: input.email ?? FieldValue.delete(),
    age: input.age ?? FieldValue.delete(),
    gender: input.gender ?? FieldValue.delete(),
    address: input.address ?? FieldValue.delete(),
    skinType: input.skinType ?? FieldValue.delete(),
    contraindications: input.contraindications ?? FieldValue.delete(),
  };

  await docRef.update(update);
}
