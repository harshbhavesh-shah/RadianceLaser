"use client";

import { useMemo, useState } from "react";
import {
  IMPORT_FIELDS,
  guessColumnMapping,
  mapImportRow,
  parseSpreadsheetFile,
  type ColumnMapping,
  type ImportPatientRow,
  type MappedRowResult,
  type ParsedSpreadsheet,
} from "@/lib/patientImport";
import { importPatientsAction, type ImportPatientsResult } from "@/app/dashboard/settings/patientImportActions";

type Step = "pick" | "map" | "preview" | "importing" | "result";

export default function PatientImportModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("pick");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedSpreadsheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportPatientsResult | null>(null);

  async function handleFile(file: File) {
    setFileName(file.name);
    setParseError(null);
    try {
      const data = await parseSpreadsheetFile(file);
      if (data.rows.length === 0) {
        setParseError("No rows found in that file — check it has a header row plus at least one patient.");
        return;
      }
      setParsed(data);
      setMapping(guessColumnMapping(data.headers));
      setStep("map");
    } catch (err) {
      console.error("Failed to parse import file:", err);
      setParseError("Couldn't read that file. Make sure it's a .csv, .xlsx, or .xls file.");
    }
  }

  const requiredMapped = mapping.name && mapping.phone;

  const mappedRows = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.map((row, i) => mapImportRow(row, mapping, i));
  }, [parsed, mapping]);

  const readyRows = mappedRows.filter(
    (r): r is MappedRowResult & { row: ImportPatientRow } => !!r.row
  );
  const skippedRows = mappedRows.filter((r) => !r.row);

  async function handleImport() {
    setStep("importing");
    try {
      const res = await importPatientsAction(readyRows.map((r) => r.row));
      setResult(res);
      setStep("result");
    } catch (err) {
      console.error("Failed to import patients:", err);
      setResult({
        imported: 0,
        skippedDuplicates: 0,
        failed: readyRows.length,
        errorSamples: ["Something went wrong. Please try again."],
      });
      setStep("result");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-surface p-6 shadow-card">
        <h2 className="font-display text-lg font-medium text-brown-900">Import Patients</h2>
        <p className="mt-1 text-sm text-brown-400">From a CSV or Excel file — matched to your patient fields.</p>
        <div className="mb-5 mt-3 h-[2px] w-8 bg-gold-500" />

        {step === "pick" && (
          <div>
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-beige-300 px-6 py-10 text-center transition-colors hover:border-gold-500">
              <span className="text-sm font-medium text-brown-700">
                Click to choose a .csv, .xlsx, or .xls file
              </span>
              <span className="text-xs text-brown-400">
                First row should be column headers (Name, Phone, Email, etc.)
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
          </div>
        )}

        {step === "map" && parsed && (
          <div>
            <p className="mb-3 text-sm text-brown-600">
              <span className="font-medium text-brown-900">{fileName}</span> — {parsed.rows.length} row
              {parsed.rows.length === 1 ? "" : "s"} found. Match each field to a column from your file.
            </p>
            <div className="space-y-2">
              {IMPORT_FIELDS.map((field) => (
                <div key={field.key} className="grid grid-cols-2 items-center gap-3">
                  <label className="text-sm text-brown-700">
                    {field.label}
                    {field.required && <span className="ml-1 text-red-600">*</span>}
                  </label>
                  <select
                    value={mapping[field.key] || ""}
                    onChange={(e) =>
                      setMapping((prev) => ({
                        ...prev,
                        [field.key]: e.target.value || undefined,
                      }))
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
            {!requiredMapped && (
              <p className="mt-3 text-xs text-red-700">Name and Phone must both be mapped to continue.</p>
            )}
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
                  {skippedRows.length} will be skipped (missing Name or Phone)
                </span>
              )}
            </div>

            {readyRows.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-beige-300">
                <table className="w-full min-w-[500px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-beige-300 bg-beige-200/50 uppercase tracking-wide text-brown-600">
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Phone</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readyRows.slice(0, 8).map((r) => (
                      <tr key={r.sourceRowIndex} className="border-b border-beige-300 last:border-0">
                        <td className="px-3 py-2 text-brown-900">{r.row.name}</td>
                        <td className="px-3 py-2 text-brown-600">{r.row.phone}</td>
                        <td className="px-3 py-2 text-brown-600">{r.row.email || "—"}</td>
                        <td className="px-3 py-2 text-brown-600">{r.row.age ?? "—"}</td>
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

            <p className="mt-3 text-xs text-brown-400">
              Patients already in your clinic with a matching phone number will be skipped automatically,
              so it&apos;s safe to re-run this if a file has duplicates.
            </p>

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
                Import {readyRows.length} Patient{readyRows.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-beige-300 border-t-gold-500" />
            <p className="text-sm text-brown-600">Importing patients…</p>
          </div>
        )}

        {step === "result" && result && (
          <div>
            <div className="space-y-2 rounded-lg border border-beige-300 p-4">
              <SummaryRow label="Imported" value={result.imported} accent />
              <SummaryRow label="Skipped (duplicates)" value={result.skippedDuplicates} />
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
