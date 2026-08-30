import "server-only";
import { prisma } from "@/lib/db/client";
import type { ConsentForm as PrismaConsentFormRow, ConsentFormTemplate as PrismaConsentFormTemplateRow } from "@prisma/client";
import type { ConsentForm, ConsentFormTemplate, SessionType } from "@/types";

// Postgres migration, chunk 9 — the ConsentFormTemplate + ConsentForm half
// of prisma/schema.prisma, migrated together for the same reason they were
// bundled there (see that model's comment). Function names/signatures
// intentionally match lib/firestore/consentForms.ts as closely as possible.

const CONSENT_FORMS_PAGE_SIZE = 25;

function toTemplate(row: PrismaConsentFormTemplateRow): ConsentFormTemplate {
  return {
    id: row.id,
    clinicId: row.clinicId,
    title: row.title,
    body: row.body,
    createdAt: Number(row.createdAt),
    ...(row.sessionType ? { sessionType: row.sessionType as SessionType } : {}),
  };
}

function toConsentForm(row: PrismaConsentFormRow): ConsentForm {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    templateId: row.templateId,
    templateTitle: row.templateTitle,
    renderedBody: row.renderedBody,
    signatureDataUrl: row.signatureDataUrl,
    signedByName: row.signedByName,
    signedAt: Number(row.signedAt),
    createdAt: Number(row.createdAt),
    ...(row.visitId ? { visitId: row.visitId } : {}),
    ...(row.witnessUid ? { witnessUid: row.witnessUid } : {}),
    ...(row.witnessName ? { witnessName: row.witnessName } : {}),
  };
}

export async function getClinicConsentTemplates(clinicId: string): Promise<ConsentFormTemplate[]> {
  const rows = await prisma.consentFormTemplate.findMany({
    where: { clinicId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toTemplate);
}

export interface ConsentFormTemplateInput {
  title: string;
  body: string;
  sessionType?: SessionType;
}

export async function createConsentFormTemplate(
  clinicId: string,
  input: ConsentFormTemplateInput
): Promise<ConsentFormTemplate> {
  const row = await prisma.consentFormTemplate.create({
    data: {
      clinicId,
      title: input.title,
      body: input.body,
      sessionType: input.sessionType ?? null,
      createdAt: BigInt(Date.now()),
    },
  });
  return toTemplate(row);
}

export async function updateConsentFormTemplate(
  clinicId: string,
  id: string,
  input: ConsentFormTemplateInput
): Promise<ConsentFormTemplate> {
  const existing = await prisma.consentFormTemplate.findUnique({ where: { id }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Template not found.");
  }
  const row = await prisma.consentFormTemplate.update({
    where: { id },
    data: { title: input.title, body: input.body, sessionType: input.sessionType ?? null },
  });
  return toTemplate(row);
}

export async function deleteConsentFormTemplate(clinicId: string, id: string): Promise<void> {
  const existing = await prisma.consentFormTemplate.findUnique({ where: { id }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Template not found.");
  }
  await prisma.consentFormTemplate.delete({ where: { id } });
}

/** Signed consent forms for one patient, newest first. */
export async function getPatientConsentForms(clinicId: string, patientId: string): Promise<ConsentForm[]> {
  const rows = await prisma.consentForm.findMany({
    where: { clinicId, patientId },
    orderBy: { signedAt: "desc" },
  });
  return rows.map(toConsentForm);
}

/** Every signed consent form across the whole clinic, in one read. Patient
 * names aren't stored on ConsentForm itself, so a caller needing to display
 * them joins against the clinic's patient list separately. The Documents
 * page's consent-forms *list* uses getClinicConsentFormsPage below instead. */
export async function getClinicConsentForms(clinicId: string): Promise<ConsentForm[]> {
  const rows = await prisma.consentForm.findMany({ where: { clinicId }, orderBy: { signedAt: "desc" } });
  return rows.map(toConsentForm);
}

export interface ConsentFormsPage {
  forms: ConsentForm[];
  nextCursor: string | null;
}

/**
 * One page of the clinic's signed consent forms, newest first — backs the
 * Documents page's Consent Forms tab. Cursor is just the last row's id
 * (unique on its own), same reasoning as getPatientsPage in
 * lib/db/patients.ts.
 */
export async function getClinicConsentFormsPage(
  clinicId: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<ConsentFormsPage> {
  const limit = opts.limit ?? CONSENT_FORMS_PAGE_SIZE;

  const rows = await prisma.consentForm.findMany({
    where: { clinicId },
    orderBy: [{ signedAt: "desc" }, { id: "desc" }],
    take: limit,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });

  const nextCursor = rows.length === limit ? rows[rows.length - 1].id : null;
  return { forms: rows.map(toConsentForm), nextCursor };
}

export interface CreateConsentFormInput {
  clinicId: string;
  patientId: string;
  templateId: string;
  templateTitle: string;
  visitId?: string;
  renderedBody: string;
  signatureDataUrl: string;
  signedByName: string;
  witnessUid: string;
  witnessName: string;
}

export async function createConsentForm(input: CreateConsentFormInput): Promise<ConsentForm> {
  const now = BigInt(Date.now());
  const row = await prisma.consentForm.create({
    data: {
      clinicId: input.clinicId,
      patientId: input.patientId,
      templateId: input.templateId,
      templateTitle: input.templateTitle,
      visitId: input.visitId ?? null,
      renderedBody: input.renderedBody,
      signatureDataUrl: input.signatureDataUrl,
      signedByName: input.signedByName,
      witnessUid: input.witnessUid,
      witnessName: input.witnessName,
      signedAt: now,
      createdAt: now,
    },
  });
  return toConsentForm(row);
}

export async function deleteConsentForm(clinicId: string, id: string): Promise<void> {
  const existing = await prisma.consentForm.findUnique({ where: { id }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Consent form not found.");
  }
  await prisma.consentForm.delete({ where: { id } });
}
