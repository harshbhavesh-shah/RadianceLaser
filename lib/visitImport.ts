// Shared between the visit/session import wizard (client — file parsing,
// column mapping, preview) and the bulk-import server action (row
// validation/shaping). Deliberately framework-light, same reasoning as
// lib/patientImport.ts: the parsing half runs in the browser.
//
// Unlike patient import, the set of importable columns isn't fixed — it
// depends on which session type (Q-Switch, LHR, or a clinic-defined machine
// type like CO2) the uploaded file's rows belong to, since each type has its
// own data-entry fields (see lib/sessionTypes.ts). So the wizard asks the
// user to pick a session type first, then builds the mapping step around
// that type's columns plus a few fields every visit needs regardless of type
// (which patient, and what date).
//
// A visit can also cover multiple treated areas/parts in one sitting (see
// VisitAreaEntry in types/index.ts and lib/visitAreas.ts) — e.g. a
// spreadsheet with "Area 1"/"HP 1"/"Fee 1", "Area 2"/"HP 2"/"Fee 2" columns,
// where each numbered group becomes one area entry on the same visit. The
// wizard asks how many parts a row can have, then repeats the column-mapping
// step once per part.

import type { SessionColumnDef } from "@/types";

export type VisitBaseFieldKey = "patientPhone" | "patientCode" | "date";

export interface VisitBaseFieldDef {
  key: VisitBaseFieldKey;
  label: string;
  required: boolean;
  synonyms: string[];
}

// Patient Phone and Patient ID aren't individually "required" — a row just
// needs to resolve to a real existing patient via at least one of them. That
// looser rule (rather than marking one of the two flatly required) is
// enforced in the wizard/action, not here.
export const VISIT_BASE_FIELDS: VisitBaseFieldDef[] = [
  {
    key: "patientPhone",
    label: "Patient Phone",
    required: false,
    synonyms: ["phone", "mobile", "contact", "phone number", "mobile number", "patient phone"],
  },
  {
    key: "patientCode",
    label: "Patient ID",
    required: false,
    synonyms: ["patient id", "patientid", "patient code", "patientcode", "id", "mrn", "uhid"],
  },
  {
    key: "date",
    label: "Visit Date",
    required: true,
    synonyms: [
      "date",
      "visit date",
      "session date",
      "last visit date",
      "last visit",
      "treatment date",
    ],
  },
];

/** Maps a base field (patientPhone/patientCode/date) to the uploaded file's
 * actual column header that supplies it. */
export type VisitColumnMapping = Record<string, string | undefined>;

/** Maps a session-type column's key to the uploaded file's actual column
 * header, for ONE part/area group. A multi-part import has one of these per
 * part (see PART_MAPPING in the wizard state). */
export type PartColumnMapping = Record<string, string | undefined>;

/** Best-effort auto-mapping for the base (non-repeating) fields, same
 * approach as guessColumnMapping() in lib/patientImport.ts: exact
 * (case-insensitive, trimmed) match against known synonyms. Always shown to
 * and editable by the user. */
export function guessVisitBaseMapping(headers: string[]): VisitColumnMapping {
  const normalized = headers.map((h) => ({ raw: h, norm: h.trim().toLowerCase() }));
  const mapping: VisitColumnMapping = {};
  for (const field of VISIT_BASE_FIELDS) {
    const match = normalized.find((h) => field.synonyms.includes(h.norm));
    if (match) mapping[field.key] = match.raw;
  }
  return mapping;
}

/** Best-effort auto-mapping for one part's session-type columns. For part 1
 * of a single-part import, a column matches its own plain label/key (e.g.
 * "Area", "Fee") — same as a normal one-area-per-row file. For part N > 1,
 * or when the wizard's part count is above 1, it additionally tries the
 * numbered variants a spreadsheet author would plausibly use: "Area 2",
 * "Area_2", "Area2", "2 Area", "Fee (2)", etc. */
export function guessPartColumnMapping(
  headers: string[],
  columns: SessionColumnDef[],
  partIndex: number, // 1-based
  partCount: number
): PartColumnMapping {
  const normalized = headers.map((h) => ({ raw: h, norm: h.trim().toLowerCase() }));
  const mapping: PartColumnMapping = {};

  for (const col of columns) {
    const label = col.label.trim().toLowerCase();
    const key = col.key.trim().toLowerCase();
    const bare = [label, key];
    const numbered =
      partCount > 1
        ? [
            `${label} ${partIndex}`,
            `${label}_${partIndex}`,
            `${label}${partIndex}`,
            `${label} (${partIndex})`,
            `${label}#${partIndex}`,
            `${partIndex} ${label}`,
            `${key} ${partIndex}`,
            `${key}_${partIndex}`,
            `${key}${partIndex}`,
            `part ${partIndex} ${label}`,
            `area ${partIndex} ${label}`,
          ]
        : [];
    // Part 1 also accepts the bare (unnumbered) header, so an existing
    // single-part file's column names keep working unchanged even once the
    // wizard defaults to "1 part".
    const synonyms = partIndex === 1 ? [...bare, ...numbered] : numbered;
    const match = normalized.find((h) => synonyms.includes(h.norm));
    if (match) mapping[col.key] = match.raw;
  }

  return mapping;
}

export interface ImportVisitRow {
  patientPhone?: string;
  patientCode?: string;
  date: string; // YYYY-MM-DD
  // One entry per treated area/part that had any data in this row — see
  // VisitAreaEntry in types/index.ts. A traditional one-area-per-row file
  // just produces a single-element array here.
  areas: Record<string, string | number>[];
}

export interface MappedVisitRowResult {
  sourceRowIndex: number;
  row: ImportVisitRow | null;
  // Human-readable reasons this row can't be imported as-is — missing date,
  // no patient identifier mapped/filled in, an unparseable date, or no
  // area/part had any data at all. A row can still be "ready" (row set)
  // even with some parts entirely empty (those are just left out).
  issues: string[];
}

const DATE_FORMATS = [
  // YYYY-MM-DD or YYYY/MM/DD
  { re: /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/, order: ["y", "m", "d"] as const },
  // DD-MM-YYYY or DD/MM/YYYY (used far more often than MM-DD in clinic
  // paperwork outside the US, and matches the app's own date-input display)
  { re: /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/, order: ["d", "m", "y"] as const },
];

/** Parses common spreadsheet date formats into the app's YYYY-MM-DD string
 * form. Returns null if the value can't be confidently parsed rather than
 * guessing — an ambiguous or malformed date is treated as a missing one, so
 * the row is flagged instead of silently getting a wrong date. */
export function normalizeImportDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  for (const { re, order } of DATE_FORMATS) {
    const m = trimmed.match(re);
    if (!m) continue;
    const parts: Record<string, number> = {};
    order.forEach((key, i) => (parts[key] = Number(m[i + 1])));
    const { y, m: mo, d } = parts;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  // Excel/SheetJS sometimes hands back a value JS's own Date parser
  // understands directly (e.g. "Jan 5 2024") — fall back to that rather than
  // rejecting every format we didn't anticipate.
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(
      parsed.getDate()
    ).padStart(2, "0")}`;
  }

  return null;
}

function parsePartFields(
  raw: Record<string, string>,
  partMapping: PartColumnMapping,
  columns: SessionColumnDef[]
): Record<string, string | number> {
  const fields: Record<string, string | number> = {};
  for (const col of columns) {
    const header = partMapping[col.key];
    const value = header ? (raw[header] || "").trim() : "";
    if (!value) continue;
    if (col.type === "number") {
      const n = Number(value);
      if (!isNaN(n)) fields[col.key] = Math.max(0, n);
    } else if (col.type === "select" && col.options) {
      const match = col.options.find((opt) => opt.toLowerCase() === value.toLowerCase());
      fields[col.key] = match || value;
    } else {
      fields[col.key] = value;
    }
  }
  return fields;
}

/** Applies the confirmed base + per-part mappings to one raw spreadsheet
 * row, producing either a ready-to-import visit row (with one area entry per
 * part that had any data) or a list of issues. */
export function mapImportVisitRow(
  raw: Record<string, string>,
  baseMapping: VisitColumnMapping,
  partMappings: PartColumnMapping[],
  columns: SessionColumnDef[],
  sourceRowIndex: number
): MappedVisitRowResult {
  function getBase(key: string): string {
    const header = baseMapping[key];
    return header ? (raw[header] || "").trim() : "";
  }

  const issues: string[] = [];

  const patientPhone = getBase("patientPhone");
  const patientCode = getBase("patientCode");
  if (!patientPhone && !patientCode) {
    issues.push("No Patient Phone or Patient ID to identify the patient");
  }

  const dateRaw = getBase("date");
  const date = dateRaw ? normalizeImportDate(dateRaw) : null;
  if (!dateRaw) {
    issues.push("Missing visit date");
  } else if (!date) {
    issues.push(`Unrecognized date format: "${dateRaw}"`);
  }

  if (issues.length > 0) {
    return { sourceRowIndex, row: null, issues };
  }

  const areas = partMappings
    .map((partMapping) => parsePartFields(raw, partMapping, columns))
    .filter((fields) => Object.keys(fields).length > 0);

  if (areas.length === 0) {
    return {
      sourceRowIndex,
      row: null,
      issues: ["No area/parameter data found in any mapped part for this row"],
    };
  }

  return {
    sourceRowIndex,
    issues: [],
    row: {
      ...(patientPhone ? { patientPhone } : {}),
      ...(patientCode ? { patientCode } : {}),
      date: date as string,
      areas,
    },
  };
}
