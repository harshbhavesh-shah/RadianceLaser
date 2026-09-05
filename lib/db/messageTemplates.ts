import "server-only";
import { prisma } from "@/lib/db/client";
import type { MessageTemplate as PrismaMessageTemplateRow } from "@prisma/client";
import type { MessageTemplate, MessageTemplateCategory } from "@/types";

// Postgres migration, chunk 10's other half — the MessageTemplate half of
// prisma/schema.prisma. This one never had a client-side Firestore write
// path (see app/dashboard/communication/actions.ts) — it was already
// admin-SDK-only, so unlike PatientPhoto there's no client component to
// convert, just this module and its two callers.

function toMessageTemplate(row: PrismaMessageTemplateRow): MessageTemplate {
  return {
    id: row.id,
    clinicId: row.clinicId,
    name: row.name,
    category: row.category as MessageTemplateCategory,
    language: row.language,
    variableLabels: row.variableLabels as unknown as string[],
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
    ...(row.bodyPreview ? { bodyPreview: row.bodyPreview } : {}),
  };
}

export async function getClinicMessageTemplates(clinicId: string): Promise<MessageTemplate[]> {
  const rows = await prisma.messageTemplate.findMany({
    where: { clinicId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toMessageTemplate);
}

export interface CreateMessageTemplateInput {
  clinicId: string;
  name: string;
  category: MessageTemplateCategory;
  language: string;
  variableLabels: string[];
  bodyPreview?: string;
}

export async function createMessageTemplate(input: CreateMessageTemplateInput): Promise<MessageTemplate> {
  const now = BigInt(Date.now());
  const row = await prisma.messageTemplate.create({
    data: {
      clinicId: input.clinicId,
      name: input.name,
      category: input.category,
      language: input.language,
      variableLabels: input.variableLabels,
      bodyPreview: input.bodyPreview ?? null,
      createdAt: now,
      updatedAt: now,
    },
  });
  return toMessageTemplate(row);
}

export async function deleteMessageTemplate(clinicId: string, id: string): Promise<void> {
  const existing = await prisma.messageTemplate.findUnique({ where: { id }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Template not found.");
  }
  await prisma.messageTemplate.delete({ where: { id } });
}
