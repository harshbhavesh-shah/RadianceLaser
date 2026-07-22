"use server";

import { getSession } from "@/lib/session";
import { getPatients, createPatient } from "@/lib/firestore/patients";
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

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, ""); // digits only, so "98765 43210" and "+91-9876543210" compare sensibly
}

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

  let imported = 0;
  let skippedDuplicates = 0;
  let failed = 0;
  const errorSamples: string[] = [];

  for (let i = 0; i < limited.length; i += BATCH_SIZE) {
    const batch = limited.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (row) => {
        const normalizedPhone = normalizePhone(row.phone);
        if (!normalizedPhone || seenPhones.has(normalizedPhone)) {
          return "duplicate" as const;
        }
        // Marked as seen synchronously, before the create below actually
        // awaits — safe because every row's map callback runs up to its
        // first `await` in order, so two rows with the same phone number
        // within this batch can't both slip past the check.
        seenPhones.add(normalizedPhone);
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
