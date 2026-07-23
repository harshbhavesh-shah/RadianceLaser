"use server";

import { getSession } from "@/lib/session";
import { getPatients, createPatient } from "@/lib/firestore/patients";
import { normalizePhone } from "@/lib/phone";
import type { ImportPatientRow } from "@/lib/patientImport";

export interface ImportPatientsResult {
  imported: number;
  skippedDuplicates: number;
  failed: number;
  errorSamples: string[]; // a few raw error messages, for troubleshooting
}

// A sane ceiling so one bad upload can't try to write an unbounded number of
// documents; well above what a clinic migrating their patient list would
// realistically have in one file.
const MAX_ROWS_PER_IMPORT = 2000;
const BATCH_SIZE = 25; // concurrent writes per batch, to avoid hammering Firestore

/**
 * Bulk-creates patients from rows already parsed and column-mapped on the
 * client (see components/settings/PatientImportModal.tsx and
 * lib/patientImport.ts). Skips rows whose phone number matches an existing
 * patient — or another row earlier in the same file — rather than creating
 * duplicates. Only the clinic owner can run this, same as the rest of
 * Settings' data-changing actions.
 */
export async function importPatientsAction(rows: ImportPatientRow[]): Promise<ImportPatientsResult> {
  const session = await getSession();
  if (!session) {
    return { imported: 0, skippedDuplicates: 0, failed: rows.length, errorSamples: ["Not signed in."] };
  }
  if (session.role !== "owner") {
    return {
      imported: 0,
      skippedDuplicates: 0,
      failed: rows.length,
      errorSamples: ["Only the clinic owner can import patients."],
    };
  }

  const limited = rows.slice(0, MAX_ROWS_PER_IMPORT);
  const existingPatients = await getPatients(session.clinicId);
  const seenPhones = new Set(existingPatients.map((p) => normalizePhone(p.phone)));
  // A clinic's own patient IDs (e.g. from their old system) must stay unique
  // here too, or two imported rows — or an imported row and an existing
  // patient — could end up sharing the same code.
  const seenCodes = new Set(
    existingPatients.map((p) => p.patientCode.trim().toUpperCase()).filter(Boolean)
  );

  let imported = 0;
  let skippedDuplicates = 0;
  let failed = 0;
  const errorSamples: string[] = [];

  for (let i = 0; i < limited.length; i += BATCH_SIZE) {
    const batch = limited.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (row) => {
        const normalizedPhone = normalizePhone(row.phone);
        const normalizedCode = row.patientCode?.trim().toUpperCase();
        if (!normalizedPhone || seenPhones.has(normalizedPhone)) {
          return "duplicate" as const;
        }
        if (normalizedCode && seenCodes.has(normalizedCode)) {
          return "duplicate" as const;
        }
        // Marked as seen synchronously, before the create below actually
        // awaits — safe because every row's map callback runs up to its
        // first `await` in order, so two rows with the same phone number
        // (or patient ID) within this batch can't both slip past the check.
        seenPhones.add(normalizedPhone);
        if (normalizedCode) seenCodes.add(normalizedCode);
        await createPatient({ clinicId: session.clinicId, ...row });
        return "imported" as const;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value === "imported") imported++;
        else skippedDuplicates++;
      } else {
        failed++;
        if (errorSamples.length < 5) {
          errorSamples.push(result.reason instanceof Error ? result.reason.message : "Unknown error");
        }
      }
    }
  }

  return { imported, skippedDuplicates, failed, errorSamples };
}
