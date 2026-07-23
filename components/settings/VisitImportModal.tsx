"use client";

import { useMemo, useState } from "react";
import {
  VISIT_BASE_FIELDS,
  guessPartColumnMapping,
  guessVisitBaseMapping,
  mapImportVisitRow,
  type ImportVisitRow,
  type MappedVisitRowResult,
  type PartColumnMapping,
  type VisitColumnMapping,
} from "@/lib/visitImport";
import { parseSpreadsheetFile, type ParsedSpreadsheet } from "@/lib/patientImport";
import {
  importVisitsAction,
  type DuplicateAction,
  type ImportVisitsResult,
} from "@/app/dashboard/settings/visitImportActions";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import type { SessionType } from "@/types";

type Step = "type" | "pick" | "map" | "preview" | "importing" | "result";
type IdentifyBy = "phone" | "patientCode" | "either";

const MAX_PARTS = 6;

export default function VisitImportModal({ onClose }: { onClose: () => void }) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const sessionTypes = Object.keys(SESSION_TYPE_CONFIG);

  const [step, setStep] = useState<Step>("type");
  const [sessionType, setSessionType] = useState<SessionType>(sessionTypes[0] || "");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedSpreadsheet | null>(null);
  const [baseMapping, setBaseMapping] = useState<VisitColumnMapping>({});
  // One mapping per part/area a row can carry — e.g. partMappings[0] covers
  // "Area"/"Fee"/etc. for part 1, partMappings[1] for part 2, and so on.
  // Almost every clinic's file will just be one part (one area per row); the
  // stepper below only needs raising for a file that logs multiple treated
  // areas per row (see components/VisitFormModal.tsx for the same idea in
  // the manual entry form).
  const [partCount, setPartCount] = useState(1);
  const [partMappings, setPartMappings] = useState<PartColumnMapping[]>([{}]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportVisitsResult | null>(null);
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>("skip");
  // Which field(s) identify the patient on each row. Many clinics migrating
  // from an old system only ever export an internal Patient ID, no phone
  // number at all — "patientCode" mode hides the (irrelevant) phone mapping
  // entirely rather than just leaving it optional-and-unused, so it's
  // unambiguous that ID-only matching is fully supported.
  const [identifyBy, setIdentifyBy] = useState<IdentifyBy>("either");

  const config = SESSION_TYPE_CONFIG[sessionType];
  const columns = useMemo(() => config?.columns || [], [config]);

  async function handleFile(file: File) {
    setFileName(file.name);
    setParseError(null);
    try {
      const data = await parseSpreadsheetFile(file);
      if (data.rows.length === 0) {
        setParseError("No rows found in that file — check it has a header row plus at least one session.");
        return;
      }
      setParsed(data);
      setBaseMapping(guessVisitBaseMapping(data.headers));
      setPartCount(1);
      setPartMappings([guessPartColumnMapping(data.headers, columns, 1, 1)]);
      setStep("map");
    } catch (err) {
      console.error("Failed to parse import file:", err);
      setParseError("Couldn't read that file. Make sure it's a .csv, .xlsx, or .xls file.");
    }
  }

  // Re-guesses every part's mapping when the part count changes, so bumping
  // from 1 to 3 parts doesn't leave parts 2 and 3 unmapped when the file's
  // headers would've matched them automatically (e.g. "Area 2", "Fee 3").
  function changePartCount(next: number) {
    const clamped = Math.max(1, Math.min(MAX_PARTS, next));
    setPartCount(clamped);
    if (!parsed) {
      setPartMappings(Array.from({ length: clamped }, () => ({})));
      return;
    }
    setPartMappings((prev) =>
      Array.from({ length: clamped }, (_, i) => prev[i] || guessPartColumnMapping(parsed.headers, columns, i + 1, clamped))
    );
  }

  function updatePartMapping(partIndex: number, columnKey: string, header: string) {
    setPartMappings((prev) =>
      prev.map((m, i) => (i === partIndex ? { ...m, [columnKey]: header || undefined } : m))
    );
  }

  const hasPatientIdentifier = !!baseMapping.patientPhone || !!baseMapping.patientCode;
  const hasDate = !!baseMapping.date;
  const requiredMapped = hasPatientIdentifier && hasDate;

  const mappedRows = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.map((row, i) => mapImportVisitRow(row, baseMapping, partMappings, columns, i));
  }, [parsed, baseMapping, partMappings, columns]);

  const readyRows = mappedRows.filter(
    (r): r is MappedVisitRowResult & { row: ImportVisitRow } => !!r.row
  );
  const skippedRows = mappedRows.filter((r) => !r.row);

  async function handleImport() {
    setStep("importing");
    try {
      const res = await importVisitsAction(sessionType, readyRows.map((r) => r.row), duplicateAction);
      setResult(res);
      setStep("result");
    } catch (err) {
      console.error("Failed to import session history:", err);
      setResult({
        imported: 0,
        updated: 0,
        skippedDuplicates: 0,
        unmatchedPatient: 0,
        failed: readyRows.length,
        errorSamples: ["Something went wrong. Please try again."],
      });
      setStep("result");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-surface p-6 shadow-card">
        <h2 className="font-display text-lg font-medium text-brown-900">Import Session History</h2>
        <p className="mt-1 text-sm text-brown-400">
          Bring in past visits — last visit date, area, fee, and every other field for a session type,
          including sessions that treated more than one area — from a CSV or Excel file. Each patient must
          already exist in Patients.
        </p>
        <div className="mb-5 mt-3 h-[2px] w-8 bg-gold-500" />

        {step === "type" && (
          <div>
            <p className="mb-3 text-sm text-brown-600">
              Which session type are these visits for? Each file should be one type at a time, since the
              fields differ (e.g. Q-Switch vs. Laser Hair Removal).
            </p>
            {sessionTypes.length === 0 ? (
              <p className="text-sm text-brown-400">No session types configured yet.</p>
            ) : (
              <div className="space-y-2">
                {sessionTypes.map((key) => (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                      sessionType === key
                        ? "border-gold-500 bg-gold-100/40"
                        : "border-beige-300 hover:border-gold-500"
                    }`}
                  >
                    <input
                      type="radio"
                      name="sessionType"
                      checked={sessionType === key}
                      onChange={() => setSessionType(key)}
                      className="accent-gold-600"
                    />
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${SESSION_TYPE_CONFIG[key].badgeClassName}`}
                    >
                      {SESSION_TYPE_CONFIG[key].badgeText}
                    </span>
                    <span className="text-sm text-brown-900">{SESSION_TYPE_CONFIG[key].label}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setStep("pick")}
                disabled={!sessionType}
                className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-40"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === "pick" && (
          <div>
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-beige-300 px-6 py-10 text-center transition-colors hover:border-gold-500">
              <span className="text-sm font-medium text-brown-700">
                Click to choose a .csv, .xlsx, or .xls file
              </span>
              <span className="text-xs text-brown-400">
                First row should be column headers ({SESSION_TYPE_CONFIG[sessionType]?.label} sessions)
              </span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </label>
            {parseError && <p className="mt-3 text-sm text-red-700">{parseError}</p>}
            <div className="mt-4">
              <button
                onClick={() => setStep("type")}
                className="rounded-md px-4 py-2 text-sm font-medium text-brown-600 hover:bg-beige-200"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {step === "map" && parsed && (
          <div>
            <p className="mb-3 text-sm text-brown-600">
              <span className="font-medium text-brown-900">{fileName}</span> — {parsed.rows.length} row
              {parsed.rows.length === 1 ? "" : "s"} found. Match each field to a column from your file.
            </p>

            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-brown-400">
              Identify the patient &amp; visit
            </p>

            <div className="mb-3">
              <p className="mb-1.5 text-sm text-brown-700">Match each row to a patient using:</p>
              <div className="flex gap-2">
                {(
                  [
                    { value: "either", label: "Either one" },
                    { value: "phone", label: "Phone Number" },
                    { value: "patientCode", label: "Patient ID only" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setIdentifyBy(opt.value);
                      // Clear out the mapping for whichever field(s) this
                      // mode no longer uses, so a stale mapping from before
                      // can't silently sneak into the import.
                      if (opt.value === "phone") {
                        setBaseMapping((prev) => ({ ...prev, patientCode: undefined }));
                      } else if (opt.value === "patientCode") {
                        setBaseMapping((prev) => ({ ...prev, patientPhone: undefined }));
                      }
                    }}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      identifyBy === opt.value
                        ? "border-gold-500 bg-gold-100/40 text-brown-900"
                        : "border-beige-300 text-brown-600 hover:border-gold-500"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-brown-400">
                {identifyBy === "patientCode"
                  ? "Only the clinic's Patient ID is needed — no phone number required, useful when migrating from a system that never recorded one."
                  : identifyBy === "phone"
                    ? "Only the phone number is used to match patients."
                    : "Either field works — handy if your file has one but not consistently the other."}
              </p>
            </div>

            <div className="space-y-2">
              {VISIT_BASE_FIELDS.filter(
                (field) =>
                  field.key === "date" ||
                  (field.key === "patientPhone" && identifyBy !== "patientCode") ||
                  (field.key === "patientCode" && identifyBy !== "phone")
              ).map((field) => (
                <div key={field.key} className="grid grid-cols-2 items-center gap-3">
                  <label className="text-sm text-brown-700">
                    {field.label}
                    {(field.required || field.key !== "date") && identifyBy !== "either" && (
                      <span className="ml-1 text-red-600">*</span>
                    )}
                  </label>
                  <select
                    value={baseMapping[field.key] || ""}
                    onChange={(e) =>
                      setBaseMapping((prev) => ({ ...prev, [field.key]: e.target.value || undefined }))
                    }
                    className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                  >
                    <option value="">— Don&apos;t import —</option>
                    {parsed.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {!hasPatientIdentifier && (
              <p className="mt-2 text-xs text-red-700">
                Map a column for {identifyBy === "phone" ? "Patient Phone" : identifyBy === "patientCode" ? "Patient ID" : "Patient Phone or Patient ID"}{" "}
                so each row can be matched to an existing patient.
              </p>
            )}

            <div className="mt-5 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-brown-400">
                {SESSION_TYPE_CONFIG[sessionType]?.label} fields
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-brown-600">Treated areas per row:</span>
                <div className="flex items-center rounded-md border border-beige-300">
                  <button
                    type="button"
                    onClick={() => changePartCount(partCount - 1)}
                    disabled={partCount <= 1}
                    className="px-2 py-1 text-sm text-brown-600 hover:bg-beige-200 disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-sm font-medium text-brown-900">{partCount}</span>
                  <button
                    type="button"
                    onClick={() => changePartCount(partCount + 1)}
                    disabled={partCount >= MAX_PARTS}
                    className="px-2 py-1 text-sm text-brown-600 hover:bg-beige-200 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            {partCount > 1 && (
              <p className="mb-2 mt-1 text-xs text-brown-400">
                A row with more than one part logs several treated areas in the same visit — e.g. Chin and
                Upper Lips together. Map each part&apos;s columns below (like &quot;Area 1&quot;, &quot;Area
                2&quot;); an empty part for a given row is simply left out of that visit.
              </p>
            )}

            <div className="space-y-4">
              {partMappings.map((partMapping, partIndex) => (
                <div key={partIndex} className={partCount > 1 ? "rounded-lg border border-beige-300 p-3" : ""}>
                  {partCount > 1 && (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brown-600">
                      Part {partIndex + 1}
                    </p>
                  )}
                  <div className="space-y-2">
                    {columns.map((col) => (
                      <div key={col.key} className="grid grid-cols-2 items-center gap-3">
                        <label className="text-sm text-brown-700">{col.label}</label>
                        <select
                          value={partMapping[col.key] || ""}
                          onChange={(e) => updatePartMapping(partIndex, col.key, e.target.value)}
                          className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                        >
                          <option value="">— Don&apos;t import —</option>
                          {parsed.headers.map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep("pick")}
                className="rounded-md px-4 py-2 text-sm font-medium text-brown-600 hover:bg-beige-200"
              >
                Back
              </button>
              <button
                onClick={() => setStep("preview")}
                disabled={!requiredMapped}
                className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-40"
              >
                Preview Import
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div>
            <div className="mb-4 flex flex-wrap gap-3 text-sm">
              <span className="rounded-full bg-gold-100 px-3 py-1 font-medium text-gold-600">
                {readyRows.length} ready to import
              </span>
              {skippedRows.length > 0 && (
                <span className="rounded-full bg-beige-200 px-3 py-1 font-medium text-brown-600">
                  {skippedRows.length} will be skipped (see issues below)
                </span>
              )}
            </div>

            {readyRows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-beige-300">
                <table className="w-full min-w-[500px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-beige-300 bg-beige-200/50 uppercase tracking-wide text-brown-600">
                      <th className="px-3 py-2 font-medium">Patient</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Areas</th>
                      {columns.slice(0, 2).map((col) => (
                        <th key={col.key} className="px-3 py-2 font-medium">
                          {col.label} (area 1)
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {readyRows.slice(0, 8).map((r) => (
                      <tr key={r.sourceRowIndex} className="border-b border-beige-300 last:border-0">
                        <td className="px-3 py-2 text-brown-900">
                          {r.row.patientPhone || r.row.patientCode}
                        </td>
                        <td className="px-3 py-2 text-brown-600">{r.row.date}</td>
                        <td className="px-3 py-2 text-brown-600">{r.row.areas.length}</td>
                        {columns.slice(0, 2).map((col) => (
                          <td key={col.key} className="px-3 py-2 text-brown-600">
                            {r.row.areas[0]?.[col.key] ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {readyRows.length > 8 && (
                  <p className="border-t border-beige-300 px-3 py-2 text-xs text-brown-400">
                    +{readyRows.length - 8} more row{readyRows.length - 8 === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            )}

            {skippedRows.length > 0 && (
              <div className="mt-3 max-h-32 overflow-y-auto rounded-md bg-red-50 p-3 text-xs text-red-700">
                {skippedRows.slice(0, 10).map((r) => (
                  <div key={r.sourceRowIndex}>
                    Row {r.sourceRowIndex + 2}: {r.issues.join(", ")}
                  </div>
                ))}
                {skippedRows.length > 10 && <div>+{skippedRows.length - 10} more</div>}
              </div>
            )}

            <p className="mt-3 text-xs text-brown-400">
              Rows won&apos;t import if their Patient Phone/ID doesn&apos;t match an existing patient — add
              those patients first, then re-run this file. A duplicate is the same patient already having a{" "}
              {SESSION_TYPE_CONFIG[sessionType]?.label} visit logged on that same date.
            </p>

            <div className="mt-4">
              <p className="mb-1.5 text-sm font-medium text-brown-700">If a duplicate is found:</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDuplicateAction("skip")}
                  className={`flex-1 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    duplicateAction === "skip"
                      ? "border-gold-500 bg-gold-100/40 text-brown-900"
                      : "border-beige-300 text-brown-600 hover:border-gold-500"
                  }`}
                >
                  <span className="font-medium">Skip</span>
                  <span className="block text-xs text-brown-400">Leave the existing visit as-is</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicateAction("replace")}
                  className={`flex-1 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    duplicateAction === "replace"
                      ? "border-gold-500 bg-gold-100/40 text-brown-900"
                      : "border-beige-300 text-brown-600 hover:border-gold-500"
                  }`}
                >
                  <span className="font-medium">Replace</span>
                  <span className="block text-xs text-brown-400">Overwrite with this file&apos;s data</span>
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep("map")}
                className="rounded-md px-4 py-2 text-sm font-medium text-brown-600 hover:bg-beige-200"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={readyRows.length === 0}
                className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-40"
              >
                Import {readyRows.length} Visit{readyRows.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-beige-300 border-t-gold-500" />
            <p className="text-sm text-brown-600">Importing session history…</p>
          </div>
        )}

        {step === "result" && result && (
          <div>
            <div className="space-y-2 rounded-lg border border-beige-300 p-4">
              <SummaryRow label="Imported" value={result.imported} accent />
              {result.updated > 0 && <SummaryRow label="Updated (replaced)" value={result.updated} />}
              {result.skippedDuplicates > 0 && (
                <SummaryRow label="Skipped (already on file)" value={result.skippedDuplicates} />
              )}
              <SummaryRow label="No matching patient" value={result.unmatchedPatient} />
              <SummaryRow label="Failed" value={result.failed} />
            </div>
            {result.errorSamples.length > 0 && (
              <div className="mt-3 rounded-md bg-red-50 p-3 text-xs text-red-700">
                {result.errorSamples.map((e, i) => (
                  <div key={i}>{e}</div>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={onClose}
                className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {step !== "result" && step !== "importing" && (
          <div className="mt-4 flex justify-end">
            <button onClick={onClose} className="text-sm font-medium text-brown-600 hover:underline">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-brown-600">{label}</span>
      <span className={`font-display text-lg font-medium ${accent ? "text-gold-600" : "text-brown-900"}`}>
        {value}
      </span>
    </div>
  );
}
