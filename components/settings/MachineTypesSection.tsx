"use client";

import { useState } from "react";
import MachineTypeFormModal, { type EditableSessionType } from "./MachineTypeFormModal";
import { BUILT_IN_SESSION_TYPE_CONFIG, pickableSessionTypeEntries } from "@/lib/sessionTypes";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import type { SessionTypeDef } from "@/types";

export default function MachineTypesSection({
  clinicId,
  initialSessionTypeDefs,
  canEdit,
}: {
  clinicId: string;
  initialSessionTypeDefs: SessionTypeDef[];
  canEdit: boolean;
}) {
  // The merged config (built-ins + clinic overrides/custom types) drives
  // what's displayed; the raw docs are only needed to know whether a given
  // type already has a Firestore doc backing it (for editing) or not (a
  // built-in that's never been customized yet).
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const [defs, setDefs] = useState<SessionTypeDef[]>(initialSessionTypeDefs);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const builtInKeys = new Set(Object.keys(BUILT_IN_SESSION_TYPE_CONFIG));
  // Not "consultation" — it's always resolvable (so historical public
  // bookings still render correctly elsewhere) but was never a pre-defined
  // default and isn't a real "machine type" a clinic configures, so it has
  // no place in this list.
  const allKeys = pickableSessionTypeEntries(SESSION_TYPE_CONFIG).map(([key]) => key);
  const existingKeys = new Set(Object.keys(SESSION_TYPE_CONFIG));

  function defFor(key: string): SessionTypeDef | undefined {
    return defs.find((d) => d.key === key);
  }

  function openCreate() {
    setEditingKey("__new__");
  }

  function openEdit(key: string) {
    setEditingKey(key);
  }

  function handleSaved(def: SessionTypeDef) {
    setDefs((prev) => {
      const exists = prev.some((d) => d.id === def.id);
      return exists ? prev.map((d) => (d.id === def.id ? def : d)) : [...prev, def];
    });
    setEditingKey(null);
  }

  const editingDef = editingKey && editingKey !== "__new__" ? defFor(editingKey) : undefined;
  const editing: EditableSessionType | null =
    editingKey && editingKey !== "__new__"
      ? {
          key: editingKey,
          docId: editingDef?.id,
          label: SESSION_TYPE_CONFIG[editingKey].label,
          badgeText: SESSION_TYPE_CONFIG[editingKey].badgeText,
          badgeClassName: SESSION_TYPE_CONFIG[editingKey].badgeClassName,
          columns: SESSION_TYPE_CONFIG[editingKey].columns,
        }
      : null;

  return (
    <div className="rounded-2xl border border-beige-300 bg-surface p-6 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-medium text-brown-900">Machine Types</h2>
          <p className="mt-0.5 text-xs text-brown-400">
            A whole new treatment category, like CO2 Laser, with its own patient tab and session
            fields. Click any type, including the built-ins, to edit its badge, color, or fields.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex-shrink-0 rounded-md border border-rust-600 px-4 py-2 text-sm font-semibold text-rust-700 transition-colors hover:bg-rust-100"
          >
            + Add Machine Type
          </button>
        )}
      </div>

      <div className="space-y-2">
        {allKeys.map((key) => {
          const cfg = SESSION_TYPE_CONFIG[key];
          const isBuiltIn = builtInKeys.has(key);
          return (
            <button
              key={key}
              onClick={() => canEdit && openEdit(key)}
              disabled={!canEdit}
              className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-beige-300 px-4 py-3 text-left transition-colors enabled:hover:bg-rust-100/40 disabled:cursor-default"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${cfg.badgeClassName}`}
                >
                  {cfg.badgeText}
                </span>
                <span className="text-sm font-medium text-brown-900">{cfg.label}</span>
              </div>
              <span className="flex flex-shrink-0 items-center gap-2 whitespace-nowrap text-[10px] text-brown-400">
                {cfg.columns.length} field{cfg.columns.length === 1 ? "" : "s"}
                {isBuiltIn && (
                  <span className="font-medium uppercase tracking-wide">· Built-in</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {editingKey === "__new__" && (
        <MachineTypeFormModal
          clinicId={clinicId}
          existingKeys={existingKeys}
          onClose={() => setEditingKey(null)}
          onSaved={handleSaved}
        />
      )}

      {editing && (
        <MachineTypeFormModal
          clinicId={clinicId}
          editing={editing}
          existingKeys={existingKeys}
          onClose={() => setEditingKey(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
