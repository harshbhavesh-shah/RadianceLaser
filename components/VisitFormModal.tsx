"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { numericFieldKeysFor } from "@/lib/sessionTypes";
import { rollupAreaFields } from "@/lib/visitAreas";
import { maybeAutoCompleteAppointment } from "@/lib/pipeline";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import { useAreaDefs } from "@/lib/areaDefsContext";
import { createVisitAction, updateVisitAction, deleteVisitAction } from "@/app/dashboard/patients/[id]/visitActions";
import type { Machine, Package, PaymentMethod, SessionType, StaffMember, Visit, VisitAreaEntry } from "@/types";

// The "area" column's key is fixed to this in both built-in session type
// configs (see lib/sessionTypes.ts) — used below to source that one
// column's options from the clinic's editable AreaDef list (Settings →
// Treatment Areas) instead of the column's own static `options`, and to
// auto-suggest a total Duration (min) from the areas picked.
const AREA_COLUMN_KEY = "area";

function todayLocalStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// One area's worth of raw (string) input state, before parsing into the
// number/string mix the Visit doc actually stores.
type AreaInput = Record<string, string>;

function blankAreaInput(columnKeys: string[]): AreaInput {
  const blank: AreaInput = {};
  for (const key of columnKeys) blank[key] = "";
  return blank;
}

export default function VisitFormModal({
  clinicId,
  patientId,
  sessionType,
  visit,
  activePackages = [],
  presetPackageId,
  appointmentId,
  machines = [],
  staff = [],
  onClose,
  onSaved,
  onDeleted,
}: {
  clinicId: string;
  patientId: string;
  sessionType: SessionType;
  visit?: Visit | null; // omit/null = creating a new visit; pass one = editing
  activePackages?: Package[]; // packages with sessions remaining, matching this sessionType
  presetPackageId?: string; // pre-select a package, e.g. opened via "Redeem Session"
  appointmentId?: string; // set when opened via "Log Visit" from an appointment — see lib/pipeline.ts
  machines?: Machine[]; // for the Analytics "revenue/time per machine" breakdown
  staff?: StaffMember[]; // for the Analytics "who performed this" breakdown
  onClose: () => void;
  onSaved: (visit: Visit) => void;
  onDeleted?: (visitId: string) => void;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const config = SESSION_TYPE_CONFIG[sessionType];
  const NUMERIC_FIELD_KEYS = numericFieldKeysFor(SESSION_TYPE_CONFIG);
  const isEditing = !!visit;
  const columnKeys = config.columns.map((c) => c.key);

  // Clinic-editable areas (Settings → Treatment Areas) for THIS session
  // type only. Falls back to the column's own built-in static options
  // (still present in lib/sessionTypes.ts) when a clinic hasn't added any
  // of its own yet, so the dropdown is never empty.
  const areaDefs = useAreaDefs().filter((a) => a.sessionType === sessionType);
  const areaColumn = config.columns.find((c) => c.key === AREA_COLUMN_KEY);
  const areaOptions = areaDefs.length > 0 ? areaDefs.map((a) => a.name) : areaColumn?.options || [];

  const [date, setDate] = useState(visit?.date || "");
  const [followUpDate, setFollowUpDate] = useState(visit?.followUpDate || "");
  const [followUpNote, setFollowUpNote] = useState(visit?.followUpNote || "");
  const [packageId, setPackageId] = useState(visit?.packageId || presetPackageId || "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(visit?.paymentMethod || "");
  const [machineId, setMachineId] = useState(visit?.machineId || "");
  const [performedByUid, setPerformedByUid] = useState(visit?.performedByUid || "");
  const [durationMinutes, setDurationMinutes] = useState(
    visit?.durationMinutes ? String(visit.durationMinutes) : ""
  );
  // Once staff type into Duration directly, stop overwriting it from area
  // selections — the auto-suggestion is a starting point, not something
  // that should fight a manual correction.
  const [durationTouched, setDurationTouched] = useState(!!visit?.durationMinutes);
  // A session can cover multiple treated areas (e.g. Chin + Upper Lips),
  // each with its own copy of this type's fields — so this is an *array* of
  // field-sets rather than one. Editing an older visit that predates this
  // (only has `visit.fields`, no `visit.areas`) seeds a single area from it,
  // which is exactly equivalent to what that visit meant before.
  const [areaEntries, setAreaEntries] = useState<AreaInput[]>(() => {
    if (visit?.areas && visit.areas.length > 0) {
      return visit.areas.map((entry) => {
        const input: AreaInput = blankAreaInput(columnKeys);
        for (const key of columnKeys) {
          const v = entry.fields[key];
          if (v !== undefined && v !== null) input[key] = String(v);
        }
        return input;
      });
    }
    if (visit?.fields) {
      const input: AreaInput = blankAreaInput(columnKeys);
      for (const key of columnKeys) {
        const v = visit.fields[key];
        if (v !== undefined && v !== null) input[key] = String(v);
      }
      return [input];
    }
    return [blankAreaInput(columnKeys)];
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPackage = activePackages.find((p) => p.id === packageId);
  const machinesForType = machines.filter((m) => m.sessionType === sessionType);

  function updateAreaField(index: number, key: string, value: string) {
    const next = areaEntries.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry));
    setAreaEntries(next);

    // Picking (or changing) an area suggests a total Duration (min) — the
    // sum of each selected area's own default across every row — as long
    // as staff haven't already typed a duration in by hand.
    if (key === AREA_COLUMN_KEY && !durationTouched) {
      const totalMinutes = next.reduce((sum, entry) => {
        const match = areaDefs.find((a) => a.name === entry[AREA_COLUMN_KEY]);
        return sum + (match?.defaultDurationMinutes || 0);
      }, 0);
      if (totalMinutes > 0) setDurationMinutes(String(totalMinutes));
    }
  }

  // A new row starts as a copy of the previous one — machine settings
  // (Mode/HP/Eng/Pass/Repeat, or HR/SHR/Stack) are usually the same pass to
  // pass, only the treated area and its fee actually change — except
  // "area" and "fee" themselves, which almost always need a fresh value,
  // so those two start blank rather than duplicating the last row's.
  // Each row is its own real entry — often a separate pass with its own
  // settings, not a repeat of the previous one — so a new row starts
  // completely blank rather than guessing values from the last row.
  function addArea() {
    setAreaEntries((prev) => [...prev, blankAreaInput(columnKeys)]);
  }

  function removeArea(index: number) {
    setAreaEntries((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function handlePackageChange(value: string) {
    setPackageId(value);
    // Covered by the package — no separate charge, otherwise it'd double
    // count against the package purchase's own revenue. Zeroes the fee on
    // every area, not just the first.
    if (value) {
      setAreaEntries((prev) => prev.map((entry) => ({ ...entry, fee: "0" })));
    }
  }

  function parseAreaEntry(entry: AreaInput): Record<string, string | number> {
    const parsed: Record<string, string | number> = {};
    for (const col of config.columns) {
      const raw = entry[col.key];
      if (!raw) continue;
      // Belt-and-suspenders on top of the inputs' min={0} — a pasted or
      // typed "-5" isn't blocked by that alone, so clamp here too rather
      // than letting a negative fee/count slip into the record.
      parsed[col.key] = NUMERIC_FIELD_KEYS.has(col.key) ? Math.max(0, Number(raw) || 0) : raw;
    }
    return parsed;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const parsedAreas: VisitAreaEntry[] = areaEntries.map((entry) => ({
      fields: parseAreaEntry(entry),
    }));
    const rolledUpFields = rollupAreaFields(
      parsedAreas.map((a) => a.fields),
      config.columns
    );

    const performedByStaff = staff.find((s) => s.uid === performedByUid);

    const formFields = {
      date,
      fields: rolledUpFields,
      areas: parsedAreas,
      packageId: packageId || undefined,
      paymentMethod: !packageId && paymentMethod ? paymentMethod : undefined,
      followUpDate: followUpDate || undefined,
      followUpNote: followUpDate && followUpNote ? followUpNote : undefined,
      machineId: machineId || undefined,
      performedByUid: performedByUid || undefined,
      performedByName: performedByStaff?.name,
      durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
    };

    try {
      if (isEditing && visit) {
        const result = await updateVisitAction(visit.id, formFields);
        if ("error" in result) {
          setError(result.error);
          setSaving(false);
          return;
        }
        onSaved({ ...visit, ...formFields });
      } else {
        const result = await createVisitAction(patientId, sessionType, appointmentId, formFields);
        if ("error" in result) {
          setError(result.error);
          setSaving(false);
          return;
        }
        onSaved({ id: result.id, clinicId, patientId, sessionType, createdAt: Date.now(), ...formFields });
        // Best-effort, non-blocking — if a receipt already exists for this
        // appointment too, this flips it to Completed automatically.
        if (appointmentId) void maybeAutoCompleteAppointment(appointmentId);
      }
    } catch (err) {
      console.error("Failed to save visit:", err);
      setError("Couldn't save. Please try again.");
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!visit) return;
    if (!confirm("Delete this visit? This can't be undone.")) return;

    setDeleting(true);
    try {
      const result = await deleteVisitAction(visit.id);
      if ("error" in result) {
        setError(result.error);
        setDeleting(false);
        return;
      }
      onDeleted?.(visit.id);
    } catch (err) {
      console.error("Failed to delete visit:", err);
      setError("Couldn't delete this visit. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-sm sm:p-6">
      <div className="flex h-full max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[18px] border border-beige-300 bg-white shadow-xl">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-beige-300 px-6 pb-6 pt-6">
          <div className="mb-2 flex items-center">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest ${config.badgeClassName}`}
            >
              {config.badgeText}
            </span>
          </div>
          <div className="inline-flex flex-col items-start">
            <h2 className="m-0 text-2xl font-extrabold tracking-tight text-brown-900">
              {isEditing ? "Edit Visit" : "Log New Visit"}
            </h2>
            <div className="mt-1.5 h-[3px] w-full rounded-full bg-rust-600" />
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-canvas/30 p-6">
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="flex flex-1 flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-brown-400">Date</label>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-40 rounded-xl border border-beige-300 bg-white px-4 py-2.5 text-sm font-medium text-brown-900 shadow-sm outline-none transition-colors focus:border-rust-600/50"
                />
                <button
                  type="button"
                  onClick={() => setDate(todayLocalStr())}
                  className="rounded-lg bg-rust-100 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-rust-600 transition-colors hover:bg-rust-600/20"
                >
                  Today
                </button>
              </div>
            </div>

            {!packageId && (
              <div className="flex flex-1 flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-brown-400">
                  Payment Method <span className="normal-case text-brown-400/70">(optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  {(["cash", "online"] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(paymentMethod === method ? "" : method)}
                      className={`rounded-xl px-5 py-2.5 text-sm font-bold capitalize shadow-sm transition-colors ${
                        paymentMethod === method
                          ? "bg-brown-900 text-white"
                          : "border border-beige-300 bg-white text-brown-900 hover:bg-beige-100"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {activePackages.length > 0 && (
            <div className="mt-6 flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-brown-400">Package</label>
              <select
                value={packageId}
                onChange={(e) => handlePackageChange(e.target.value)}
                className="w-full rounded-xl border border-beige-300 bg-white px-4 py-2.5 text-sm font-medium text-brown-900 shadow-sm outline-none transition-colors focus:border-rust-600/50"
              >
                <option value="">None, pay per visit</option>
                {activePackages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.label}
                  </option>
                ))}
              </select>
              {selectedPackage && (
                <p className="text-xs text-rust-600">
                  Covered by {selectedPackage.label}, no separate fee for this visit.
                </p>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-brown-400">
              Follow-up Date <span className="normal-case text-brown-400/70">(optional)</span>
            </label>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-40 rounded-xl border border-beige-300 bg-white px-4 py-2.5 text-sm font-medium text-brown-900 shadow-sm outline-none transition-colors focus:border-rust-600/50"
            />
            {followUpDate && (
              <input
                value={followUpNote}
                onChange={(e) => setFollowUpNote(e.target.value)}
                placeholder="What's this follow-up about? e.g. Check for reaction"
                className="w-full rounded-xl border border-beige-300 bg-white px-4 py-2.5 text-sm font-medium text-brown-900 shadow-sm outline-none transition-colors focus:border-rust-600/50"
              />
            )}
          </div>

          {(machinesForType.length > 0 || staff.length > 0) && (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {machinesForType.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-brown-400">Machine</label>
                  <select
                    value={machineId}
                    onChange={(e) => setMachineId(e.target.value)}
                    className="w-full rounded-xl border border-beige-300 bg-white px-4 py-2.5 text-sm font-medium text-brown-900 shadow-sm outline-none transition-colors focus:border-rust-600/50"
                  >
                    <option value="">— None —</option>
                    {machinesForType.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {staff.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-brown-400">Performed By</label>
                  <select
                    value={performedByUid}
                    onChange={(e) => setPerformedByUid(e.target.value)}
                    className="w-full rounded-xl border border-beige-300 bg-white px-4 py-2.5 text-sm font-medium text-brown-900 shadow-sm outline-none transition-colors focus:border-rust-600/50"
                  >
                    <option value="">— None —</option>
                    {staff.map((s) => (
                      <option key={s.uid} value={s.uid}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-brown-400">Duration</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={durationMinutes}
                    onChange={(e) => {
                      setDurationMinutes(e.target.value);
                      setDurationTouched(true);
                    }}
                    className="w-full rounded-xl border border-beige-300 bg-white py-2.5 pl-4 pr-10 text-sm font-medium text-brown-900 shadow-sm outline-none transition-colors focus:border-rust-600/50"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-brown-400">
                    min
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Spreadsheet-style entry — one row per pass/area, every column
              editable per row, styled after the clinic's old Excel-based
              sheet so multi-pass/multi-area sessions are fast to type
              across (tab or click cell to cell) instead of filling in a
              separate card per area. */}
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-brown-900">Session Entries</label>
              <button
                type="button"
                onClick={addArea}
                className="inline-flex items-center gap-1 text-xs font-bold text-rust-600 transition-colors hover:text-rust-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Row
              </button>
            </div>

            <div className="flex flex-col overflow-hidden rounded-xl border border-beige-300 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-beige-300 bg-beige-100/40">
                      {config.columns.map((col) => (
                        <th
                          key={col.key}
                          className="whitespace-nowrap px-3 py-3 text-left text-[10px] font-extrabold uppercase tracking-widest text-brown-400"
                        >
                          {col.label}
                        </th>
                      ))}
                      {areaEntries.length > 1 && <th className="w-10" />}
                    </tr>
                  </thead>
                  <tbody>
                    {areaEntries.map((entry, index) => {
                      const isLastRow = index === areaEntries.length - 1;
                      return (
                        <tr key={index} className="border-b border-beige-200 last:border-b-0">
                          {config.columns.map((col, colIndex) => {
                            const isFeeLocked = col.key === "fee" && !!packageId;
                            const isLastCell = isLastRow && colIndex === config.columns.length - 1;
                            return (
                              <td key={col.key} className="p-1.5">
                                {col.type === "select" ? (
                                  <select
                                    value={entry[col.key] || ""}
                                    onChange={(e) => updateAreaField(index, col.key, e.target.value)}
                                    className="w-full min-w-[6rem] rounded-lg border border-transparent bg-transparent px-2 py-2 text-sm text-brown-900 outline-none transition-colors hover:border-beige-300 focus:border-rust-600/60"
                                  >
                                    <option value="">—</option>
                                    {(col.key === AREA_COLUMN_KEY ? areaOptions : col.options)?.map((opt) => (
                                      <option key={opt} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type={col.type === "number" ? "number" : "text"}
                                    min={col.type === "number" ? 0 : undefined}
                                    value={entry[col.key] || ""}
                                    onChange={(e) => updateAreaField(index, col.key, e.target.value)}
                                    onKeyDown={(e) => {
                                      // Mirrors a spreadsheet's "Enter adds a
                                      // new row" — only from the last cell of
                                      // the last row, so it never fires
                                      // mid-row.
                                      if (isLastCell && e.key === "Enter") {
                                        e.preventDefault();
                                        addArea();
                                      }
                                    }}
                                    disabled={isFeeLocked}
                                    className="w-full min-w-[5.5rem] rounded-lg border border-transparent bg-transparent px-2 py-2 text-sm text-brown-900 outline-none transition-colors hover:border-beige-300 focus:border-rust-600/60 disabled:text-brown-400"
                                  />
                                )}
                              </td>
                            );
                          })}
                          {areaEntries.length > 1 && (
                            <td className="p-1.5 text-center">
                              <button
                                type="button"
                                onClick={() => removeArea(index)}
                                className="rounded p-1.5 text-brown-400 hover:bg-red-50 hover:text-red-600"
                                aria-label="Remove row"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {areaEntries.length > 1 && (
              <p className="text-xs text-brown-400">
                Fee shown on receipts/reports for this visit will be the total across all rows above.
              </p>
            )}
          </div>

          {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 items-center justify-between border-t border-beige-300 bg-white px-6 py-4">
          <div>
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-sm font-bold text-red-700 hover:underline disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete Visit"}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-bold text-brown-400 transition-colors hover:text-brown-900"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-rust-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-rust-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Visit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
