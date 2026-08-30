import "server-only";
import { prisma } from "@/lib/db/client";
import { normalizePhone } from "@/lib/phone";
import type { Patient as PrismaPatientRow } from "@prisma/client";
import type { Patient, SkinType } from "@/types";

// Postgres migration, chunk 1 — this is the Patient half of the
// lib/firestore/patients.ts → lib/db/patients.ts move (see prisma/schema.prisma
// for why: Patient/Visit were the two collections actually responsible for
// blowing through Firestore's daily read quota). Function names/signatures
// intentionally match the Firestore module as closely as possible so
// call-site changes are just the import path, not the call shape.

const PATIENT_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
const PATIENTS_PAGE_SIZE = 25;
const SEARCH_RESULT_LIMIT = 20;

function generatePatientCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += PATIENT_CODE_CHARS.charAt(Math.floor(Math.random() * PATIENT_CODE_CHARS.length));
  }
  return `PT-${code}`;
}

// The app's Patient type (types/index.ts) uses a plain `number` for
// createdAt, matching every other timestamp in the app (Date.now()) —
// Postgres stores it as BigInt (see schema.prisma for why), so every read
// converts back to a number at this boundary. Nothing outside lib/db/
// should ever see a bigint.
function toPatient(row: PrismaPatientRow): Patient {
  return {
    id: row.id,
    clinicId: row.clinicId,
    name: row.name,
    phone: row.phone,
    phoneNormalized: row.phoneNormalized,
    nameLower: row.nameLower,
    patientCode: row.patientCode,
    createdAt: Number(row.createdAt),
    ...(row.email ? { email: row.email } : {}),
    ...(row.age !== null ? { age: row.age } : {}),
    ...(row.gender ? { gender: row.gender } : {}),
    ...(row.address ? { address: row.address } : {}),
    ...(row.skinType ? { skinType: row.skinType as SkinType } : {}),
    ...(row.contraindications ? { contraindications: row.contraindications } : {}),
    ...(row.legacyPatientNo !== null ? { legacyPatientNo: row.legacyPatientNo } : {}),
  };
}

/** Every patient in the clinic, in one read. EXPENSIVE at real scale —
 * same reasoning as the Firestore version this replaces. Only genuine
 * "need the whole roster" call sites should use this — bulk import dedup,
 * clinic-wide CSV export. Name-lookup joins should use getPatientsByIds
 * instead, and the Patients list page uses getPatientsPage. */
export async function getPatients(clinicId: string): Promise<Patient[]> {
  const rows = await prisma.patient.findMany({
    where: { clinicId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toPatient);
}

/** Whether this clinic has ever added a single patient — backs the
 * onboarding checklist's "Add your first patient" step. */
export async function clinicHasAnyPatient(clinicId: string): Promise<boolean> {
  const row = await prisma.patient.findFirst({ where: { clinicId }, select: { id: true } });
  return row !== null;
}

/** Total patient count — backs Dashboard's "Total Patients" stat. */
export async function getClinicPatientCount(clinicId: string): Promise<number> {
  return prisma.patient.count({ where: { clinicId } });
}

/** Patients created on or after a given time — backs Dashboard's "New
 * Patients {window}" stat without reading the whole roster. */
export async function getPatientsCreatedSince(clinicId: string, sinceMs: number): Promise<Patient[]> {
  const rows = await prisma.patient.findMany({
    where: { clinicId, createdAt: { gte: BigInt(sinceMs) } },
  });
  return rows.map(toPatient);
}

/** Just the patients actually referenced by whatever's on screen (e.g.
 * today's appointments, the last few visits, a clinic's active packages) —
 * the replacement for calling getPatients() to build a name-lookup map. */
export async function getPatientsByIds(ids: string[]): Promise<Patient[]> {
  const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
  if (uniqueIds.length === 0) return [];
  const rows = await prisma.patient.findMany({ where: { id: { in: uniqueIds } } });
  return rows.map(toPatient);
}

export interface PatientsPage {
  patients: Patient[];
  /** The last patient id on this page — pass back in as `cursor` for the
   * next page. Null once there's nothing more to load. */
  nextCursor: string | null;
}

/**
 * One page of a clinic's patients, newest first — used by the Patients list
 * page so opening it never reads the entire roster. Cursor-based (not
 * offset-based) so page N stays a single cheap query no matter how deep N
 * gets. Unlike the Firestore version, the cursor is just the last row's id
 * (already globally unique) — no createdAt/id compound tiebreaker needed,
 * since Prisma's cursor pagination only requires a unique field to seek on.
 */
export async function getPatientsPage(
  clinicId: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<PatientsPage> {
  const limit = opts.limit ?? PATIENTS_PAGE_SIZE;

  const rows = await prisma.patient.findMany({
    where: { clinicId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });

  const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;
  return { patients: rows.map(toPatient), nextCursor };
}

/**
 * Server-side patient search across name, phone, and patient code — backs
 * the Patients list search bar. Unlike the Firestore version this
 * replaces (limited to prefix matching — Firestore has no substring
 * search), Postgres ILIKE does a real substring match, so this is a
 * genuine UX improvement, not just a port: searching "swani" now finds
 * "Rajeswani" too, not just names starting with it.
 */
export async function searchPatients(clinicId: string, rawQuery: string): Promise<Patient[]> {
  const q = rawQuery.trim();
  if (!q) return [];

  const phoneDigits = normalizePhone(q);
  const rows = await prisma.patient.findMany({
    where: {
      clinicId,
      OR: [
        { nameLower: { contains: q.toLowerCase() } },
        { patientCode: { contains: q.toUpperCase() } },
        ...(phoneDigits ? [{ phoneNormalized: { contains: phoneDigits } }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: SEARCH_RESULT_LIMIT,
  });
  return rows.map(toPatient);
}

export async function getPatient(clinicId: string, patientId: string): Promise<Patient | null> {
  const row = await prisma.patient.findUnique({ where: { id: patientId } });
  // Belt-and-suspenders tenant check, same reasoning as the Firestore
  // version — never trust a record's own id alone to imply ownership.
  if (!row || row.clinicId !== clinicId) return null;
  return toPatient(row);
}

/** Finds an existing patient with the same phone number (digits-only
 * comparison), so the create/edit forms can warn before quietly creating a
 * duplicate record for someone who's already a patient. Pass
 * excludePatientId when checking from an edit form, so a patient's own
 * unchanged phone number doesn't flag itself as a duplicate. */
export async function findPatientByPhone(
  clinicId: string,
  phone: string,
  excludePatientId?: string
): Promise<Patient | null> {
  const target = normalizePhone(phone);
  if (!target) return null;

  const row = await prisma.patient.findFirst({
    where: { clinicId, phoneNormalized: target, ...(excludePatientId ? { id: { not: excludePatientId } } : {}) },
  });
  return row ? toPatient(row) : null;
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
  const row = await prisma.patient.create({
    data: {
      clinicId: input.clinicId,
      name: input.name,
      phone: input.phone,
      phoneNormalized: normalizePhone(input.phone),
      nameLower: input.name.toLowerCase(),
      patientCode: input.patientCode?.trim() || generatePatientCode(),
      createdAt: BigInt(Date.now()),
      email: input.email ?? null,
      age: input.age ?? null,
      gender: input.gender ?? null,
      address: input.address ?? null,
      skinType: input.skinType ?? null,
      contraindications: input.contraindications ?? null,
    },
  });
  return row.id;
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
 * field explicitly falls back to `null` when omitted, so clearing one
 * (e.g. removing a skin type) actually clears it instead of leaving the
 * old value behind. */
export async function updatePatient(clinicId: string, patientId: string, input: UpdatePatientInput): Promise<void> {
  const existing = await prisma.patient.findUnique({ where: { id: patientId }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Patient not found.");
  }

  await prisma.patient.update({
    where: { id: patientId },
    data: {
      name: input.name,
      phone: input.phone,
      phoneNormalized: normalizePhone(input.phone),
      nameLower: input.name.toLowerCase(),
      email: input.email ?? null,
      age: input.age ?? null,
      gender: input.gender ?? null,
      address: input.address ?? null,
      skinType: input.skinType ?? null,
      contraindications: input.contraindications ?? null,
    },
  });
}
