"use client";

import { useState } from "react";
import { addDoc, collection, deleteDoc, deleteField, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { numericFieldKeysFor } from "@/lib/sessionTypes";
import { rollupAreaFields } from "@/lib/visitAreas";
import { maybeAutoCompleteAppointment } from "@/lib/pipeline";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import PermissionErrorNotice from "@/components/PermissionErrorNotice";
import type { Machine, Package, SessionType, StaffMember, Visit, VisitAreaEntry } from "@/types";

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
  const [packageId, setPackageId] = useState(visit?.packageId || presetPackageId || "");
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
  const [permissionError, setPermissionError] = useState(false);

  const selectedPackage = activePackages.find((p) => p.id === packageId);
  const machinesForType = machines.filter((m) => m.sessionType === sessionType);

  function updateAreaField(index: number, key: string, value: string) {
    setAreaEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry))
    );
  }

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

    try {
      if (isEditing && visit) {
        const updatePayload: Record<string, unknown> = {
          date,
          fields: rolledUpFields,
          areas: parsedAreas,
        };
        // Firestore rejects `undefined` field values — clearing an optional
        // link (package, machine, staff) needs an explicit deleteField(),
        // otherwise the stale value would silently stay on the document.
        updatePayload.packageId = packageId ? packageId : deleteField();
        updatePayload.machineId = machineId ? machineId : deleteField();
        updatePayload.performedByUid = performedByUid ? performedByUid : deleteField();
        updatePayload.performedByName = performedByStaff ? performedByStaff.name : deleteField();
        updatePayload.durationMinutes = durationMinutes ? Number(durationMinutes) : deleteField();
        await updateDoc(doc(db, "visits", visit.id), updatePayload);
        onSaved({
          ...visit,
          date,
          fields: rolledUpFields,
          areas: parsedAreas,
          packageId: packageId || undefined,
          machineId: machineId || undefined,
          performedByUid: performedByUid || undefined,
          performedByName: performedByStaff?.name,
          durationMinutes: durationMinutes ? Number(durationMinutes) : undefined,
        });
      } else {
        const createPayload = {
          clinicId,
          patientId,
          sessionType,
          date,
          fields: rolledUpFields,
          areas: parsedAreas,
          ...(packageId ? { packageId } : {}),
          ...(machineId ? { machineId } : {}),
          ...(performedByUid ? { performedByUid, performedByName: performedByStaff?.name } : {}),
          ...(durationMinutes ? { durationMinutes: Number(durationMinutes) } : {}),
          ...(appointmentId ? { appointmentId } : {}),
          createdAt: Date.now(),
        };
        const docRef = await addDoc(collection(db, "visits"), createPayload);
        onSaved({ id: docRef.id, ...createPayload });
        // Best-effort, non-blocking — if a receipt already exists for this
        // appointment too, this flips it to Completed automatically.
        if (appointmentId) void maybeAutoCompleteAppointment(appointmentId);
      }
    } catch (err) {
      console.error("Failed to save visit:", err);
      const code = (err as { code?: string })?.code;
      const isPermissionError = code === "permission-denied";
      setPermissionError(isPermissionError);
      setError(
        isPermissionError
          ? // This almost always means the browser's cached sign-in token
            // predates a clinicId/role claim change — Firebase bakes custom
            // claims into the ID token at sign-in and doesn't refresh them
            // automatically. Signing out and back in (button below) fetches
            // a token with the current claims. See PermissionErrorNotice.
            "You don't have permission to save this — most likely your sign-in needs refreshing."
          : `Couldn't save (${code || "unknown error"}). Please try again.`
      );
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
      await deleteDoc(doc(db, "visits", visit.id));
      onDeleted?.(visit.id);
    } catch (err) {
      console.error("Failed to delete visit:", err);
      setError("Couldn't delete this visit. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-1 flex items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${config.badgeClassName}`}
          >
            {config.badgeText}
          </span>
          <h2 className="font-display text-lg font-medium text-brown-900">
            {isEditing ? "Edit Visit" : "Log New Visit"}
          </h2>
        </div>
        <div className="mb-5 h-[2px] w-8 bg-gold-500" />

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

        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-brown-700">
            Treated Area{areaEntries.length > 1 ? "s" : ""}
          </label>
          <button
            type="button"
            onClick={addArea}
            className="text-sm font-medium text-gold-600 hover:underline"
          >
            + Add Another Area
          </button>
        </div>

        <div className="space-y-3">
          {areaEntries.map((entry, index) => {
            const isFeeLockedByPackage = !!packageId;
            return (
              <div
                key={index}
                className="rounded-lg border border-beige-300 p-3"
              >
                {areaEntries.length > 1 && (
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-brown-400">
                      Area {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeArea(index)}
                      className="text-xs font-medium text-red-700 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {config.columns.map((col) => {
                    const isFeeLocked = col.key === "fee" && isFeeLockedByPackage;
                    return (
                      <div key={col.key}>
                        <label className="mb-1.5 block text-sm font-medium text-brown-700">
                          {col.label}
                        </label>
                        {col.type === "select" ? (
                          <select
                            value={entry[col.key] || ""}
                            onChange={(e) => updateAreaField(index, col.key, e.target.value)}
                            className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                          >
                            <option value="">— Select —</option>
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
                            disabled={isFeeLocked}
                            className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500 disabled:bg-beige-200 disabled:text-brown-400"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {areaEntries.length > 1 && (
          <p className="mt-3 text-xs text-brown-400">
            Fee shown on receipts/reports for this visit will be the total across all areas above.
          </p>
        )}

        {error && permissionError && (
          <div className="mt-4">
            <PermissionErrorNotice message={error} />
          </div>
        )}
        {error && !permissionError && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
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
