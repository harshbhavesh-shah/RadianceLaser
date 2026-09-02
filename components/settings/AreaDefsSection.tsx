"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import AreaFormModal from "./AreaFormModal";
import { useAreaDefs, useAreaDefsActions } from "@/lib/areaDefsContext";
import { deleteAreaDefAction } from "@/app/dashboard/settings/areaDefActions";
import type { AreaDef, SessionType } from "@/types";

const SESSION_TYPES: { key: SessionType; label: string }[] = [
  { key: "qs", label: "Q-Switch" },
  { key: "lhr", label: "Laser Hair Removal" },
];

type EditingState = { sessionType: SessionType; area: AreaDef | null } | null;

export default function AreaDefsSection({ canEdit }: { canEdit: boolean }) {
  const areaDefs = useAreaDefs();
  const { addAreaDef, updateAreaDefInList, removeAreaDef } = useAreaDefsActions();
  const [editing, setEditing] = useState<EditingState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleSaved(def: AreaDef) {
    const isNew = !areaDefs.some((a) => a.id === def.id);
    if (isNew) addAreaDef(def);
    else updateAreaDefInList(def);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this treatment area? It'll disappear from the Area dropdown going forward.")) return;
    setDeletingId(id);
    const result = await deleteAreaDefAction(id);
    if (result.error) {
      alert(result.error);
    } else {
      removeAreaDef(id);
    }
    setDeletingId(null);
  }

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="mb-4">
        <h2 className="font-display text-lg font-medium text-brown-900">Treatment Areas</h2>
        <p className="mt-0.5 text-xs text-brown-400">
          The options staff pick from on the Area field when logging a Q-Switch or Laser Hair
          Removal visit — add your own, or edit an existing one&apos;s name, typical duration, and
          whether GST applies.
        </p>
      </div>

      <div className="space-y-6">
        {SESSION_TYPES.map(({ key, label }) => {
          const areas = areaDefs.filter((a) => a.sessionType === key);
          return (
            <div key={key}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-brown-700">{label}</h3>
                {canEdit && (
                  <button
                    onClick={() => setEditing({ sessionType: key, area: null })}
                    className="text-xs font-medium text-gold-600 hover:underline"
                  >
                    + Add Area
                  </button>
                )}
              </div>

              {areas.length === 0 ? (
                <p className="rounded-lg border border-dashed border-beige-300 px-4 py-3 text-xs text-brown-400">
                  No custom areas yet — the visit form falls back to a built-in default list.
                </p>
              ) : (
                <div className="space-y-2">
                  {areas.map((area) => (
                    <div
                      key={area.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-beige-300 px-4 py-2.5"
                    >
                      <button
                        onClick={() => canEdit && setEditing({ sessionType: key, area })}
                        disabled={!canEdit}
                        className="min-w-0 flex-1 text-left enabled:cursor-pointer"
                      >
                        <span className="text-sm font-medium text-brown-900">{area.name}</span>
                        <span className="ml-2 text-xs text-brown-400">
                          {area.defaultDurationMinutes ? `${area.defaultDurationMinutes} min` : "no default duration"}
                          {" · "}
                          {area.gstApplicable ? "GST applicable" : "GST exempt"}
                        </span>
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => handleDelete(area.id)}
                          disabled={deletingId === area.id}
                          className="flex-shrink-0 rounded p-1.5 text-brown-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          aria-label={`Remove ${area.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <AreaFormModal
          sessionType={editing.sessionType}
          editing={editing.area}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
