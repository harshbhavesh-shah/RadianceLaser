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

/** Maps a base field or a session-type column key to the uploaded file's
 * actual column header that supplies it. Session-type columns are keyed by
 * their own `key` (e.g. "area", "fee"), same as VisitBaseFieldKey for the
 * fixed fields — both live in one flat lookup since a spreadsheet header can
 * only be mapped to one destination anyway. */
export type VisitColumnMapping = Record<string, string | undefined>;

/** Best-effort auto-mapping, same approach as guessColumnMapping() in
 * lib/patientImport.ts: exact (case-insensitive, trimmed) match against known
 * synonyms for the base fields, and against the column's own label/key for
 * session-type-specific fields. Always shown to and editable by the user. */
export function guessVisitColumnMapping(
  headers: string[],
  columns: SessionColumnDef[]
): VisitColumnMapping {
  const normalized = headers.map((h) => ({ raw: h, norm: h.trim().toLowerCase() }));
  const mapping: VisitColumnMapping = {};

  for (const field of VISIT_BASE_FIELDS) {
    const match = normalized.find((h) => field.synonyms.includes(h.norm));
    if (match) mapping[field.key] = match.raw;
  }

  for (const col of columns) {
    const synonyms = [col.label.trim().toLowerCase(), col.key.trim().toLowerCase()];
    const match = normalized.find((h) => synonyms.includes(h.norm));
    if (match) mapping[col.key] = match.raw;
  }

  return mapping;
}

export interface ImportVisitRow {
  patientPhone?: string;
  patientCode?: string;
  date: string; // YYYY-MM-DD
  fields: Record<string, string | number>;
}

export interface MappedVisitRowResult {
  sourceRowIndex: number;
  row: ImportVisitRow | null;
  // Human-readable reasons this row can't be imported as-is — missing date,
  // no patient identifier mapped/filled in, or an unparseable date. A row
  // can still be "ready" (row set) even with an empty optional field.
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

/** Applies the confirmed column mapping to one raw spreadsheet row for a
 * specific session type's columns, producing either a ready-to-import visit
 * row or a list of issues. Number-typed columns are parsed and clamped to
 * >= 0 (same rule as the manual Visit form); select-typed columns are
 * matched case-insensitively against the column's own options and fall back
 * to the raw text if nothing matches, so an unexpected value is kept
 * visible rather than silently dropped. */
export function mapImportVisitRow(
  raw: Record<string, string>,
  mapping: VisitColumnMapping,
  columns: SessionColumnDef[],
  sourceRowIndex: number
): MappedVisitRowResult {
  function get(key: string): string {
    const header = mapping[key];
    return header ? (raw[header] || "").trim() : "";
  }

  const issues: string[] = [];

  const patientPhone = get("patientPhone");
  const patientCode = get("patientCode");
  if (!patientPhone && !patientCode) {
    issues.push("No Patient Phone or Patient ID to identify the patient");
  }

  const dateRaw = get("date");
  const date = dateRaw ? normalizeImportDate(dateRaw) : null;
  if (!dateRaw) {
    issues.push("Missing visit date");
  } else if (!date) {
    issues.push(`Unrecognized date format: "${dateRaw}"`);
  }

  if (issues.length > 0) {
    return { sourceRowIndex, row: null, issues };
  }

  const fields: Record<string, string | number> = {};
  for (const col of columns) {
    const value = get(col.key);
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

  return {
    sourceRowIndex,
    issues: [],
    row: {
      ...(patientPhone ? { patientPhone } : {}),
      ...(patientCode ? { patientCode } : {}),
      date: date as string,
      fields,
    },
  };
}
