"use server";

import { getSession } from "@/lib/session";
import { getPatients } from "@/lib/firestore/patients";
import { getClinicVisits, createVisit, updateVisit } from "@/lib/firestore/visits";
import { getClinicSessionTypeDefs } from "@/lib/firestore/sessionTypeDefs";
import { buildSessionTypeConfig } from "@/lib/sessionTypes";
import { rollupAreaFields } from "@/lib/visitAreas";
import { normalizePhone } from "@/lib/phone";
import type { ImportVisitRow } from "@/lib/visitImport";
import type { SessionType, VisitAreaEntry } from "@/types";

export type DuplicateAction = "skip" | "replace";

export interface ImportVisitsResult {
  imported: number;
  updated: number; // duplicates overwritten, only when duplicateAction is "replace"
  skippedDuplicates: number; // duplicates left untouched, only when duplicateAction is "skip"
  unmatchedPatient: number; // Patient Phone/ID didn't resolve to an existing patient
  failed: number;
  errorSamples: string[];
}

const MAX_ROWS_PER_IMPORT = 3000;
const BATCH_SIZE = 25;

/**
 * Bulk-creates (or updates) past session/visit history from rows already
 * parsed and column-mapped on the client (see
 * components/settings/VisitImportModal.tsx and lib/visitImport.ts). Every
 * row must resolve to an *existing* patient — by phone number or by the
 * clinic's own Patient ID — since a visit can't be logged against nobody;
 * rows that don't match are counted separately rather than silently skipped
 * alongside duplicates, so the clinic can go fix them (e.g. import patients
 * first) and re-run just this file.
 *
 * Each row can carry more than one treated area/part (e.g. a file with
 * "Area 1"/"Fee 1", "Area 2"/"Fee 2" columns) — row.areas already has one
 * entry per part with any data, from the client-side mapping step. This
 * action re-derives the flat `fields` rollup itself (via the clinic's own
 * session-type column config, not whatever the client happened to send) so
 * a visit's stored `fields` is always trustworthy regardless of what the
 * import wizard did or didn't compute.
 *
 * A "duplicate" here means the same patient already has a visit of this
 * exact session type on this exact date — deliberately *not* comparing the
 * field values too, since that would make "Replace" pointless (two rows can
 * only meaningfully conflict, and be worth overwriting, if they're for the
 * same patient/type/day but disagree on the details). duplicateAction
 * controls what happens to those: "skip" (default, and the only behavior
 * before this option existed) leaves the existing visit untouched; "replace"
 * overwrites its date/areas/fields with the imported row's. Only the clinic
 * owner can run this, same as the patient import.
 */
export async function importVisitsAction(
  sessionType: SessionType,
  rows: ImportVisitRow[],
  duplicateAction: DuplicateAction = "skip"
): Promise<ImportVisitsResult> {
  const session = await getSession();
  if (!session) {
    return {
      imported: 0,
      updated: 0,
      skippedDuplicates: 0,
      unmatchedPatient: 0,
      failed: rows.length,
      errorSamples: ["Not signed in."],
    };
  }
  if (session.role !== "owner") {
    return {
      imported: 0,
      updated: 0,
      skippedDuplicates: 0,
      unmatchedPatient: 0,
      failed: rows.length,
      errorSamples: ["Only the clinic owner can import session history."],
    };
  }

  const limited = rows.slice(0, MAX_ROWS_PER_IMPORT);
  const [patients, existingVisits, sessionTypeDefs] = await Promise.all([
    getPatients(session.clinicId),
    getClinicVisits(session.clinicId),
    getClinicSessionTypeDefs(session.clinicId),
  ]);
  const columns = buildSessionTypeConfig(sessionTypeDefs)[sessionType]?.columns || [];

  const byPhone = new Map(
    patients.filter((p) => normalizePhone(p.phone)).map((p) => [normalizePhone(p.phone), p])
  );
  const byCode = new Map(patients.map((p) => [p.patientCode.trim().toUpperCase(), p]));

  // Maps a "same patient/type/day" key to the existing visit it refers to —
  // used both to detect duplicates and, for "replace", to know which
  // document to overwrite. Seeded from what's already in Firestore; updated
  // as rows are processed so two duplicate rows within the same file are
  // handled consistently (the second replaces/skips against whichever won
  // out from the first, not against the stale pre-import state).
  const visitByKey = new Map(
    existingVisits.filter((v) => v.sessionType === sessionType).map((v) => [`${v.patientId}|${v.date}`, v.id])
  );

  let imported = 0;
  let updated = 0;
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

        const areas: VisitAreaEntry[] = row.areas.map((fields) => ({ fields }));
        const fields = rollupAreaFields(row.areas, columns);

        const key = `${patient.id}|${row.date}`;
        const existingVisitId = visitByKey.get(key);

        if (existingVisitId) {
          if (duplicateAction === "skip") {
            return "duplicate" as const;
          }
          await updateVisit(existingVisitId, { date: row.date, fields, areas });
          return "updated" as const;
        }

        const newId = await createVisit({
          clinicId: session.clinicId,
          patientId: patient.id,
          sessionType,
          date: row.date,
          fields,
          areas,
        });
        // Same in-batch-race reasoning as the patient import: marked seen
        // synchronously relative to later rows in this same run.
        visitByKey.set(key, newId);
        return "imported" as const;
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value === "imported") imported++;
        else if (result.value === "updated") updated++;
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

  return { imported, updated, skippedDuplicates, unmatchedPatient, failed, errorSamples };
}
