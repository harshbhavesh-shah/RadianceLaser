"use client";

import { useState } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { slugifySessionTypeKey, sessionTypeDefToConfig } from "@/lib/sessionTypes";
import { useAddSessionType } from "@/lib/sessionTypeConfigContext";
import type { SessionColumnDef, SessionFieldType, SessionTypeDef } from "@/types";

const COLOR_PRESETS = [
  { name: "Brown", badgeClassName: "bg-brown-900 text-beige-200", chartColor: "#2C1D14" },
  { name: "Gold", badgeClassName: "bg-gold-600 text-white", chartColor: "#A9812F" },
  { name: "Blue", badgeClassName: "bg-blue-700 text-white", chartColor: "#1D4ED8" },
  { name: "Green", badgeClassName: "bg-green-700 text-white", chartColor: "#15803D" },
  { name: "Purple", badgeClassName: "bg-purple-700 text-white", chartColor: "#7E22CE" },
  { name: "Red", badgeClassName: "bg-red-700 text-white", chartColor: "#B91C1C" },
  { name: "Teal", badgeClassName: "bg-teal-700 text-white", chartColor: "#0F766E" },
] as const;

const FIELD_TYPES: { value: SessionFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown" },
];

interface DraftColumn {
  label: string;
  type: SessionFieldType;
  optionsText: string; // comma-separated, only used when type === "select"
}

function slugifyColumnKey(label: string, taken: Set<string>): string {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "field";
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

function columnsToDraft(columns: SessionColumnDef[]): DraftColumn[] {
  return columns.map((c) => ({
    label: c.label,
    type: c.type,
    optionsText: (c.options || []).join(", "),
  }));
}

function findColorIdx(badgeClassName: string): number {
  const i = COLOR_PRESETS.findIndex((p) => p.badgeClassName === badgeClassName);
  return i === -1 ? 0 : i;
}

/** Describes the type being edited — undefined/null means "create a new
 * type" instead. Works the same whether the type being edited is a
 * clinic-defined custom type or one of the built-ins (Q-Switch/LHR): editing
 * a built-in for the first time just creates its first override doc. */
export interface EditableSessionType {
  key: string; // fixed — never editable, since Visits/Machines/etc. reference it
  docId?: string; // Firestore sessionTypeDefs doc id, if an override/custom doc already exists
  label: string;
  badgeText: string;
  badgeClassName: string;
  columns: SessionColumnDef[];
}

export default function MachineTypeFormModal({
  clinicId,
  editing,
  existingKeys,
  onClose,
  onSaved,
}: {
  clinicId: string;
  editing?: EditableSessionType | null;
  existingKeys: Set<string>; // built-in + already-defined custom type keys, for uniqueness when creating
  onClose: () => void;
  onSaved: (def: SessionTypeDef) => void;
}) {
  const addSessionType = useAddSessionType();
  const isEditing = !!editing;

  const [label, setLabel] = useState(editing?.label || "");
  const [badgeText, setBadgeText] = useState(editing?.badgeText || "");
  const [colorIdx, setColorIdx] = useState(editing ? findColorIdx(editing.badgeClassName) : 0);
  const [columns, setColumns] = useState<DraftColumn[]>(
    editing
      ? columnsToDraft(editing.columns)
      : [
          { label: "Area", type: "text", optionsText: "" },
          { label: "Fee", type: "number", optionsText: "" },
        ]
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateColumn(i: number, patch: Partial<DraftColumn>) {
    setColumns((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function addColumn() {
    setColumns((prev) => [...prev, { label: "", type: "text", optionsText: "" }]);
  }

  function removeColumn(i: number) {
    setColumns((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) return setError("Machine type name is required.");

    const validColumns = columns.filter((c) => c.label.trim());
    if (validColumns.length === 0) {
      return setError("Add at least one session data field (e.g. Area, Fee).");
    }

    const key = isEditing ? editing!.key : slugifySessionTypeKey(trimmedLabel, existingKeys);
    const preset = COLOR_PRESETS[colorIdx];

    const columnKeys = new Set<string>();
    const columnDefs: SessionColumnDef[] = validColumns.map((c) => {
      const colKey = slugifyColumnKey(c.label, columnKeys);
      columnKeys.add(colKey);
      const col: SessionColumnDef = { key: colKey, label: c.label.trim(), type: c.type };
      if (c.type === "select") {
        col.options = c.optionsText
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean);
      }
      return col;
    });

    setSaving(true);
    setError(null);

    const fields = {
      label: trimmedLabel,
      badgeText: (badgeText.trim() || trimmedLabel.slice(0, 4)).toUpperCase(),
      badgeClassName: preset.badgeClassName,
      chartColor: preset.chartColor,
      columns: columnDefs,
    };

    try {
      let saved: SessionTypeDef;
      if (isEditing && editing!.docId) {
        // Updating an existing custom type, or a built-in that already has
        // an override doc from a previous edit.
        await updateDoc(doc(db, "sessionTypeDefs", editing!.docId), fields);
        saved = { id: editing!.docId, clinicId, key, createdAt: Date.now(), ...fields };
      } else {
        // Either a brand-new custom type, or the *first* edit of a built-in
        // (which creates its first override doc, keyed to the built-in's
        // fixed key — e.g. "qs" — so it takes over from the hardcoded default).
        const payload = { clinicId, key, createdAt: Date.now(), ...fields };
        const docRef = await addDoc(collection(db, "sessionTypeDefs"), payload);
        saved = { id: docRef.id, ...payload };
      }
      addSessionType(key, sessionTypeDefToConfig(saved));
      onSaved(saved);
    } catch (err) {
      console.error("Failed to save machine type:", err);
      const code = (err as { code?: string })?.code;
      setError(
        code === "permission-denied"
          ? "You don't have permission to save this. Check that Firestore rules are deployed and try signing in again."
          : "Couldn't save this machine type. Please try again."
      );
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface p-6 shadow-card">
        <h2 className="font-display text-lg font-medium text-brown-900">
          {isEditing ? `Edit ${editing!.label}` : "Add Machine Type"}
        </h2>
        <p className="mt-1 text-sm text-brown-400">
          {isEditing
            ? "Changes apply everywhere this machine type shows up — the patient tab, visit form, and Analytics."
            : "For a whole new category of treatment — e.g. a CO2 laser — not another unit of an existing type. It gets its own tab on every patient page and its own session fields below."}
        </p>
        <div className="mb-5 mt-3 h-[2px] w-8 bg-gold-500" />

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">
              Machine Type Name
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. CO2 Laser"
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">
                Badge Text <span className="text-brown-400">(optional)</span>
              </label>
              <input
                type="text"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                placeholder="e.g. CO2"
                maxLength={6}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-brown-700">Color</label>
              <select
                value={colorIdx}
                onChange={(e) => setColorIdx(Number(e.target.value))}
                className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
              >
                {COLOR_PRESETS.map((p, i) => (
                  <option key={p.name} value={i}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-sm font-medium text-brown-700">
                Session Data Fields
              </label>
              <button
                type="button"
                onClick={addColumn}
                className="text-xs font-medium text-gold-600 hover:underline"
              >
                + Add Field
              </button>
            </div>
            <p className="mb-2 text-xs text-brown-400">
              These show up on the visit form every time a session of this type is logged. Include
              a numeric &quot;Fee&quot; field so this type&apos;s revenue shows up in Analytics.
              {isEditing &&
                " Removing or renaming a field here won't touch data already logged on past visits — it only changes the form going forward."}
            </p>

            <div className="space-y-2">
              {columns.map((col, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={col.label}
                    onChange={(e) => updateColumn(i, { label: e.target.value })}
                    placeholder="Field label, e.g. Wattage"
                    className="min-w-0 flex-1 rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                  />
                  <select
                    value={col.type}
                    onChange={(e) => updateColumn(i, { type: e.target.value as SessionFieldType })}
                    className="flex-shrink-0 rounded-md border border-beige-300 bg-canvas px-2 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                  >
                    {FIELD_TYPES.map((ft) => (
                      <option key={ft.value} value={ft.value}>
                        {ft.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeColumn(i)}
                    className="flex-shrink-0 rounded-md px-2 py-1 text-sm text-red-700 hover:bg-red-50"
                    aria-label="Remove field"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {columns.map((col, i) =>
                col.type === "select" ? (
                  <input
                    key={`opts-${i}`}
                    type="text"
                    value={col.optionsText}
                    onChange={(e) => updateColumn(i, { optionsText: e.target.value })}
                    placeholder={`Options for "${col.label || "this field"}", comma separated`}
                    className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
                  />
                ) : null
              )}
            </div>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-brown-600 hover:bg-beige-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
          >
            {saving ? "Saving…" : isEditing ? "Save Changes" : "Create Machine Type"}
          </button>
        </div>
      </div>
    </div>
  );
}
