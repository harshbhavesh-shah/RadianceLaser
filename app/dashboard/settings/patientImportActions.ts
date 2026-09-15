"use server";

import { getSession } from "@/lib/session";
import { getPatients, createPatient, updatePatient } from "@/lib/db/patients";
import { normalizePhone } from "@/lib/phone";
import type { ImportPatientRow } from "@/lib/patientImport";

export type DuplicateAction = "skip" | "replace";

export interface ImportPatientsResult {
  imported: number;
  updated: number; // duplicates overwritten, only when duplicateAction is "replace"
  skippedDuplicates: number; // duplicates left untouched, only when duplicateAction is "skip"
  failed: number;
  errorSamples: string[]; // a few raw error messages, for troubleshooting
}

// A sane ceiling so one bad upload can't try to write an unbounded number of
// documents; well above what a clinic migrating their patient list would
// realistically have in one file.
const MAX_ROWS_PER_IMPORT = 2000;
const BATCH_SIZE = 25; // concurrent writes per batch, to avoid hammering Firestore

/**
 * Bulk-creates (or updates) patients from rows already parsed and
 * column-mapped on the client (see components/settings/PatientImportModal.tsx
 * and lib/patientImport.ts). A row is a "duplicate" if its phone number — or
 * its Patient ID, if mapped — matches an existing patient (or another row
 * earlier in the same file). duplicateAction controls what happens to those:
 * "skip" (the default, and the only behavior before this option existed)
 * leaves the existing patient untouched; "replace" overwrites their record
 * with the imported row's values — handy when re-importing a corrected
 * export from a clinic's old system. Only the clinic owner can run this,
 * same as the rest of Settings' data-changing actions.
 */
export async function importPatientsAction(
  rows: ImportPatientRow[],
  duplicateAction: DuplicateAction = "skip"
): Promise<ImportPatientsResult> {
  const session = await getSession();
  if (!session) {
    return {
      imported: 0,
      updated: 0,
      skippedDuplicates: 0,
      failed: rows.length,
      errorSamples: ["Not signed in."],
    };
  }
  if (session.role !== "owner") {
    return {
      imported: 0,
      updated: 0,
      skippedDuplicates: 0,
      failed: rows.length,
      errorSamples: ["Only the clinic owner can import patients."],
    };
  }

  const limited = rows.slice(0, MAX_ROWS_PER_IMPORT);
  const existingPatients = await getPatients(session.clinicId);
  // Maps a normalized phone/code to the patient it belongs to — used both to
  // detect duplicates and, for "replace", to know which document to
  // overwrite. Updated as rows are processed, so two duplicate rows in the
  // same file are handled consistently against each other, not just against
  // what was already in Firestore before this import started.
  //
  // Values are Promise<string>, not string — a row's entry has to be
  // reserved synchronously (before its `createPatient` call awaits) for a
  // later duplicate in the same batch to see it; at that point the new
  // patient's real id isn't known yet, so the entry is the in-flight
  // promise that will eventually resolve to it. batch.map below runs each
  // row's callback synchronously up to its first `await`, in order, so this
  // reservation is what actually closes the race — resolving the id after
  // the await (as a plain string map once did) is too late, since a second
  // row's synchronous duplicate check would already have missed it.
  //
  // Explicit [string, string] return types below are required, not
  // stylistic — without them, TS infers `.map()`'s array-literal return as
  // the widened `string[]` rather than a tuple, and chaining `.filter()`
  // afterward loses whatever contextual tuple typing `new Map()` might
  // otherwise have inferred. That mismatch (string[] vs. the tuple shape
  // Map's constructor expects) is exactly what broke the Vercel build.
  const byPhone = new Map<string, Promise<string>>(
    existingPatients
      .filter((p) => normalizePhone(p.phone))
      .map((p): [string, Promise<string>] => [normalizePhone(p.phone), Promise.resolve(p.id)])
  );
  const byCode = new Map<string, Promise<string>>(
    existingPatients
      .map((p): [string, Promise<string>] => [p.patientCode.trim().toUpperCase(), Promise.resolve(p.id)])
      .filter(([code]) => code)
  );

  let imported = 0;
  let updated = 0;
  let skippedDuplicates = 0;
  let failed = 0;
  const errorSamples: string[] = [];

  for (let i = 0; i < limited.length; i += BATCH_SIZE) {
    const batch = limited.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (row) => {
        const normalizedPhone = normalizePhone(row.phone);
        const normalizedCode = row.patientCode?.trim().toUpperCase();
        const existingIdPromise =
          (normalizedPhone && byPhone.get(normalizedPhone)) ||
          (normalizedCode && byCode.get(normalizedCode)) ||
          undefined;

        if (existingIdPromise) {
          if (duplicateAction === "skip") {
            return "duplicate" as const;
          }
          // Awaits the reservation above if the "existing" match is
          // actually an earlier row in this same batch still being
          // created — resolves immediately if it's a patient that already
          // existed before this import started.
          const existingId = await existingIdPromise;
          await updatePatient(session.clinicId, existingId, row);
          return "updated" as const;
        }

        // Reserved synchronously, before the create below actually awaits
        // — every row's map callback runs up to its first `await` in
        // order, so a later row with the same phone number (or patient ID)
        // in this batch sees this reservation instead of slipping past the
        // check above and creating a second patient for the same person.
        let resolveNewId!: (id: string) => void;
        const newIdPromise = new Promise<string>((resolve) => {
          resolveNewId = resolve;
        });
        if (normalizedPhone) byPhone.set(normalizedPhone, newIdPromise);
        if (normalizedCode) byCode.set(normalizedCode, newIdPromise);

        const newId = await createPatient({ clinicId: session.clinicId, ...row });
        resolveNewId(newId);
        return "imported" as const;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value === "imported") imported++;
        else if (result.value === "updated") updated++;
        else skippedDuplicates++;
      } else {
        failed++;
        if (errorSamples.length < 5) {
          errorSamples.push(result.reason instanceof Error ? result.reason.message : "Unknown error");
        }
      }
    }
  }

  return { imported, updated, skippedDuplicates, failed, errorSamples };
}
