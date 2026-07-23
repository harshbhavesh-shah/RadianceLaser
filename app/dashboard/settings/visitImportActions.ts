"use server";

import { getSession } from "@/lib/session";
import { getPatients } from "@/lib/firestore/patients";
import { getClinicVisits, createVisit } from "@/lib/firestore/visits";
import { normalizePhone } from "@/lib/phone";
import type { ImportVisitRow } from "@/lib/visitImport";
import type { SessionType } from "@/types";

export interface ImportVisitsResult {
  imported: number;
  skippedDuplicates: number; // same patient + session type + date + fields, already on file
  unmatchedPatient: number; // Patient Phone/ID didn't resolve to an existing patient
  failed: number;
  errorSamples: string[];
}

const MAX_ROWS_PER_IMPORT = 3000;
const BATCH_SIZE = 25;

function fieldsSignature(fields: Record<string, string | number>): string {
  return JSON.stringify(
    Object.entries(fields)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, v])
  );
}

/**
 * Bulk-creates past session/visit history from rows already parsed and
 * column-mapped on the client (see components/settings/VisitImportModal.tsx
 * and lib/visitImport.ts). Every row must resolve to an *existing* patient —
 * by phone number or by the clinic's own Patient ID — since a visit can't be
 * logged against nobody; rows that don't match are counted separately rather
 * than silently skipped alongside duplicates, so the clinic can go fix them
 * (e.g. import patients first) and re-run just this file. Only the clinic
 * owner can run this, same as the patient import.
 */
export async function importVisitsAction(
  sessionType: SessionType,
  rows: ImportVisitRow[]
): Promise<ImportVisitsResult> {
  const session = await getSession();
  if (!session) {
    return {
      imported: 0,
      skippedDuplicates: 0,
      unmatchedPatient: 0,
      failed: rows.length,
      errorSamples: ["Not signed in."],
    };
  }
  if (session.role !== "owner") {
    return {
      imported: 0,
      skippedDuplicates: 0,
      unmatchedPatient: 0,
      failed: rows.length,
      errorSamples: ["Only the clinic owner can import session history."],
    };
  }

  const limited = rows.slice(0, MAX_ROWS_PER_IMPORT);
  const [patients, existingVisits] = await Promise.all([
    getPatients(session.clinicId),
    getClinicVisits(session.clinicId),
  ]);

  const byPhone = new Map(
    patients.filter((p) => normalizePhone(p.phone)).map((p) => [normalizePhone(p.phone), p])
  );
  const byCode = new Map(patients.map((p) => [p.patientCode.trim().toUpperCase(), p]));

  // Guards against re-running the same file twice creating duplicate history
  // — a visit is considered "already there" if the same patient has a visit
  // of this session type, on the same date, with the exact same field
  // values. Legitimately having two same-day sessions with different
  // details (e.g. different area) still imports both.
  const seenSignatures = new Set(
    existingVisits
      .filter((v) => v.sessionType === sessionType)
      .map((v) => `${v.patientId}|${v.date}|${fieldsSignature(v.fields)}`)
  );

  let imported = 0;
  let skippedDuplicates = 0;
  let unmatchedPatient = 0;
  let failed = 0;
  const errorSamples: string[] = [];

  for (let i = 0; i < limited.length; i += BATCH_SIZE) {
    const batch = limited.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (row) => {
        const patient =
          (row.patientPhone && byPhone.get(normalizePhone(row.patientPhone))) ||
          (row.patientCode && byCode.get(row.patientCode.trim().toUpperCase())) ||
          undefined;

        if (!patient) {
          return "unmatched" as const;
        }

        const signature = `${patient.id}|${row.date}|${fieldsSignature(row.fields)}`;
        if (seenSignatures.has(signature)) {
          return "duplicate" as const;
        }
        // Same in-batch-race reasoning as the patient import: marked seen
        // synchronously, before the create below awaits.
        seenSignatures.add(signature);

        await createVisit({
          clinicId: session.clinicId,
          patientId: patient.id,
          sessionType,
          date: row.date,
          fields: row.fields,
        });
        return "imported" as const;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value === "imported") imported++;
        else if (result.value === "duplicate") skippedDuplicates++;
        else unmatchedPatient++;
      } else {
        failed++;
        if (errorSamples.length < 5) {
          errorSamples.push(result.reason instanceof Error ? result.reason.message : "Unknown error");
        }
      }
    }
  }

  return { imported, skippedDuplicates, unmatchedPatient, failed, errorSamples };
}
