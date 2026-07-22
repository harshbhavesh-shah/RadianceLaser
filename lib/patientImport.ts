// Shared between the import wizard (client — file parsing, column mapping,
// preview) and the bulk-import server action (row validation/shaping).
// Deliberately framework-light: no server-only import here, since the
// parsing half runs in the browser.

import type { SkinType } from "@/types";

export type ImportFieldKey =
  | "name"
  | "phone"
  | "email"
  | "age"
  | "gender"
  | "address"
  | "skinType"
  | "contraindications";

export interface ImportFieldDef {
  key: ImportFieldKey;
  label: string;
  required: boolean;
  synonyms: string[]; // lowercase, for auto-matching uploaded column headers
}

export const IMPORT_FIELDS: ImportFieldDef[] = [
  { key: "name", label: "Name", required: true, synonyms: ["name", "full name", "patient name", "patient"] },
  {
    key: "phone",
    label: "Phone",
    required: true,
    synonyms: ["phone", "mobile", "contact", "phone number", "mobile number", "contact number"],
  },
  { key: "email", label: "Email", required: false, synonyms: ["email", "email address", "e-mail"] },
  { key: "age", label: "Age", required: false, synonyms: ["age"] },
  { key: "gender", label: "Gender", required: false, synonyms: ["gender", "sex"] },
  { key: "address", label: "Address", required: false, synonyms: ["address", "location"] },
  {
    key: "skinType",
    label: "Skin Type",
    required: false,
    synonyms: ["skin type", "skintype", "fitzpatrick", "fitzpatrick type", "fitzpatrick skin type"],
  },
  {
    key: "contraindications",
    label: "Contraindications / Notes",
    required: false,
    synonyms: ["contraindications", "notes", "medical notes", "remarks", "comments"],
  },
];

/** Maps an import field (e.g. "phone") to the uploaded file's actual column
 * header (e.g. "Mobile Number") that supplies it. */
export type ColumnMapping = Partial<Record<ImportFieldKey, string>>;

/** Best-effort auto-mapping from uploaded column headers to import fields,
 * by exact (case-insensitive, trimmed) match against known synonyms. Always
 * shown to and editable by the user before import — never applied blind. */
export function guessColumnMapping(headers: string[]): ColumnMapping {
  const normalized = headers.map((h) => ({ raw: h, norm: h.trim().toLowerCase() }));
  const mapping: ColumnMapping = {};
  for (const field of IMPORT_FIELDS) {
    const match = normalized.find((h) => field.synonyms.includes(h.norm));
    if (match) mapping[field.key] = match.raw;
  }
  return mapping;
}

export interface ParsedSpreadsheet {
  headers: string[];
  rows: Record<string, string>[];
}

/** Parses a .csv, .xlsx, or .xls file into headers + row objects. Uses
 * SheetJS, which handles all three formats uniformly — the file's first row
 * is treated as headers. */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return { headers: [], rows: [] };

  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  const headers = (raw[0] || []).map((h) => String(h ?? "").trim());
  const dataRows = raw
    .slice(1)
    .filter((r) => Array.isArray(r) && r.some((cell) => String(cell ?? "").trim() !== ""));

  const rows = dataRows.map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = String((r as unknown[])[i] ?? "").trim();
    });
    return obj;
  });

  return { headers, rows };
}

export interface ImportPatientRow {
  name: string;
  phone: string;
  email?: string;
  age?: number;
  gender?: string;
  address?: string;
  skinType?: SkinType;
  contraindications?: string;
}

const VALID_SKIN_TYPES: SkinType[] = ["I", "II", "III", "IV", "V", "VI"];
const SKIN_TYPE_NUMBER_ALIASES: Record<string, SkinType> = {
  "1": "I",
  "2": "II",
  "3": "III",
  "4": "IV",
  "5": "V",
  "6": "VI",
};

function normalizeSkinType(raw: string): SkinType | undefined {
  const v = raw.trim().toUpperCase();
  if (!v) return undefined;
  if ((VALID_SKIN_TYPES as string[]).includes(v)) return v as SkinType;
  return SKIN_TYPE_NUMBER_ALIASES[v];
}

export interface MappedRowResult {
  sourceRowIndex: number; // 0-based index into the parsed rows, for error messages
  row: ImportPatientRow | null; // null if required fields are missing
  missingRequired: string[]; // field labels, only set when row is null
}

/** Applies the confirmed column mapping to one raw spreadsheet row,
 * producing either a ready-to-import patient row or a list of missing
 * required fields. Also normalizes age (to a number) and skin type (to the
 * app's I–VI scale, accepting "1"–"6" as well). */
export function mapImportRow(
  raw: Record<string, string>,
  mapping: ColumnMapping,
  sourceRowIndex: number
): MappedRowResult {
  function get(key: ImportFieldKey): string {
    const header = mapping[key];
    return header ? (raw[header] || "").trim() : "";
  }

  const name = get("name");
  const phone = get("phone");
  const missingRequired: string[] = [];
  if (!name) missingRequired.push("Name");
  if (!phone) missingRequired.push("Phone");
  if (missingRequired.length > 0) {
    return { sourceRowIndex, row: null, missingRequired };
  }

  const ageRaw = get("age");
  const age = ageRaw && !isNaN(Number(ageRaw)) ? Number(ageRaw) : undefined;
  const skinType = normalizeSkinType(get("skinType"));
  const email = get("email");
  const gender = get("gender");
  const address = get("address");
  const contraindications = get("contraindications");

  return {
    sourceRowIndex,
    missingRequired: [],
    row: {
      name,
      phone,
      ...(email ? { email } : {}),
      ...(age !== undefined ? { age } : {}),
      ...(gender ? { gender } : {}),
      ...(address ? { address } : {}),
      ...(skinType ? { skinType } : {}),
      ...(contraindications ? { contraindications } : {}),
    },
  };
}
