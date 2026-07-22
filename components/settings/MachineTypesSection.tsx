"use client";

import { useState } from "react";
import MachineTypeFormModal, { type EditableSessionType } from "./MachineTypeFormModal";
import { BUILT_IN_SESSION_TYPE_CONFIG } from "@/lib/sessionTypes";
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
  const allKeys = Object.keys(SESSION_TYPE_CONFIG);
  const existingKeys = new Set(allKeys);

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
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-medium text-brown-900">Machine Types</h2>
          <p className="mt-0.5 text-xs text-brown-400">
            A whole new treatment category — e.g. CO2 Laser — with its own patient tab and session
            fields. Click any type, including the built-ins, to edit its badge, color, or fields.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex-shrink-0 rounded-md border border-brown-900 px-4 py-2 text-sm font-semibold text-brown-900 transition-colors hover:bg-brown-900 hover:text-beige-200"
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
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-beige-300 px-4 py-3 text-left transition-colors enabled:hover:bg-gold-100/40 disabled:cursor-default"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${cfg.badgeClassName}`}
                >
                  {cfg.badgeText}
                </span>
                <span className="text-sm font-medium text-brown-900">{cfg.label}</span>
              </div>
              <span className="flex items-center gap-2 text-[10px] text-brown-400">
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
