"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { numericFieldKeysFor } from "@/lib/sessionTypes";
import { rollupAreaFields } from "@/lib/visitAreas";
import { maybeAutoCompleteAppointment } from "@/lib/pipeline";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import { createVisitAction, updateVisitAction, deleteVisitAction } from "@/app/dashboard/patients/[id]/visitActions";
import type { Machine, Package, PaymentMethod, SessionType, StaffMember, Visit, VisitAreaEntry } from "@/types";

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
    setAreaEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry))
    );
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4 py-6">
      <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-1 flex flex-shrink-0 items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${config.badgeClassName}`}
          >
            {config.badgeText}
          </span>
          <h2 className="font-display text-lg font-medium text-brown-900">
            {isEditing ? "Edit Visit" : "Log New Visit"}
          </h2>
        </div>
        <div className="mb-4 h-[2px] w-8 flex-shrink-0 bg-gold-500" />

        <div className="flex-shrink-0 overflow-y-auto">
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-brown-700">Date</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
              <button
                type="button"
                onClick={() => setDate(todayLocalStr())}
                className="flex-shrink-0 rounded-md border border-beige-300 px-3 py-2 text-sm font-medium text-brown-600 transition-colors hover:border-gold-500 hover:text-gold-600"
              >
                Today
              </button>
            </div>
          </div>

          {activePackages.length > 0 && (
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-brown-700">Package</label>
              <select
                value={packageId}
                onChange={(e) => handlePackageChange(e.target.value)}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              >
                <option value="">None — pay per visit</option>
                {activePackages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.label}
                  </option>
                ))}
              </select>
              {selectedPackage && (
                <p className="mt-1.5 text-xs text-gold-600">
                  Covered by {selectedPackage.label} — no separate fee for this visit.
                </p>
              )}
            </div>
          )}

          {/* Only meaningful for a direct-pay visit — a package-covered
              session has no new payment of its own (see PaymentMethod in
              types/index.ts). */}
          {!packageId && (
            <div className="mb-4">
              <label className="mb-1.5 block text-sm font-medium text-brown-700">
                Payment Method <span className="text-brown-400">(optional)</span>
              </label>
              <div className="flex gap-2">
                {(["cash", "online"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(paymentMethod === method ? "" : method)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                      paymentMethod === method
                        ? "border-gold-500 bg-gold-100 text-gold-600"
                        : "border-beige-300 text-brown-600 hover:border-gold-500"
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-brown-700">
              Follow-up Date <span className="text-brown-400">(optional)</span>
            </label>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
            {followUpDate && (
              <input
                value={followUpNote}
                onChange={(e) => setFollowUpNote(e.target.value)}
                placeholder="What's this follow-up about? e.g. Check for reaction"
                className="mt-2 w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            )}
          </div>

          {(machinesForType.length > 0 || staff.length > 0) && (
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {machinesForType.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-brown-700">Machine</label>
                  <select
                    value={machineId}
                    onChange={(e) => setMachineId(e.target.value)}
                    className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
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
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-brown-700">Performed By</label>
                  <select
                    value={performedByUid}
                    onChange={(e) => setPerformedByUid(e.target.value)}
                    className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
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
              <div>
                <label className="mb-1.5 block text-sm font-medium text-brown-700">Duration (min)</label>
                <input
                  type="number"
                  min={0}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Spreadsheet-style entry — one row per pass/area, every column
            editable per row, styled after the clinic's old Excel-based
            sheet so multi-pass/multi-area sessions are fast to type across
            (tab or click cell to cell) instead of filling in a separate
            card per area. */}
        <div className="mt-4 flex min-h-0 flex-1 flex-col">
          <div className="mb-2 flex flex-shrink-0 items-center justify-between">
            <label className="font-display text-base font-medium text-brown-900">Session Entries</label>
            <button
              type="button"
              onClick={addArea}
              className="text-sm font-medium text-gold-600 hover:underline"
            >
              + Add Row
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-beige-300">
            <table className="w-full min-w-[640px] border-collapse text-base">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-beige-300 bg-beige-100">
                  {config.columns.map((col) => (
                    <th
                      key={col.key}
                      className="whitespace-nowrap border border-beige-300 px-3 py-3 text-left text-sm font-semibold uppercase tracking-wide text-brown-600"
                    >
                      {col.label}
                    </th>
                  ))}
                  {areaEntries.length > 1 && <th className="w-10 border border-beige-300" />}
                </tr>
              </thead>
              <tbody>
                {areaEntries.map((entry, index) => {
                  const isLastRow = index === areaEntries.length - 1;
                  return (
                    <tr key={index}>
                      {config.columns.map((col, colIndex) => {
                        const isFeeLocked = col.key === "fee" && !!packageId;
                        const isLastCell = isLastRow && colIndex === config.columns.length - 1;
                        return (
                          <td key={col.key} className="border border-beige-200 p-1.5">
                            {col.type === "select" ? (
                              <select
                                value={entry[col.key] || ""}
                                onChange={(e) => updateAreaField(index, col.key, e.target.value)}
                                className="w-full min-w-[6rem] rounded border-0 bg-transparent px-2 py-2.5 text-base text-brown-900 outline-none focus:bg-gold-100/40 focus:ring-1 focus:ring-gold-500"
                              >
                                <option value="">—</option>
                                {col.options?.map((opt) => (
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
                                  // Mirrors a spreadsheet's "Enter adds a new
                                  // row" — only from the last cell of the
                                  // last row, so it never fires mid-row.
                                  if (isLastCell && e.key === "Enter") {
                                    e.preventDefault();
                                    addArea();
                                  }
                                }}
                                disabled={isFeeLocked}
                                className="w-full min-w-[5.5rem] rounded border-0 bg-transparent px-2 py-2.5 text-base text-brown-900 outline-none focus:bg-gold-100/40 focus:ring-1 focus:ring-gold-500 disabled:text-brown-400"
                              />
                            )}
                          </td>
                        );
                      })}
                      {areaEntries.length > 1 && (
                        <td className="border border-beige-200 p-1.5 text-center">
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

          {areaEntries.length > 1 && (
            <p className="mt-2 flex-shrink-0 text-xs text-brown-400">
              Fee shown on receipts/reports for this visit will be the total across all rows above.
            </p>
          )}
        </div>

        {error && <p className="mt-4 flex-shrink-0 text-sm text-red-700">{error}</p>}

        <div className="mt-4 flex flex-shrink-0 items-center justify-between">
          <div>
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-sm font-medium text-red-700 hover:underline disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete Visit"}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-brown-600 hover:bg-beige-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Visit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
