"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import AreaFormModal from "./AreaFormModal";
import { useAreaDefs, useAreaDefsActions } from "@/lib/areaDefsContext";
import { deleteAreaDefAction } from "@/app/dashboard/areas/actions";
import type { AreaDef, SessionType } from "@/types";

// Q-Switch used to be listed here too; it isn't a pre-defined default
// anymore (see lib/sessionTypes.ts) so this only manages Areas for the
// one built-in a new clinic actually starts with.
const SESSION_TYPES: { key: SessionType; label: string }[] = [
  { key: "lhr", label: "Laser Hair Removal" },
];

type EditingState = { sessionType: SessionType; area: AreaDef | null } | null;

/** Grouped list-card treatment matches the Figma design's Treatment Areas
 * screen — a header + "Add Area" per session type, then a single
 * divided-row card per group. This panel itself lives inside the
 * Patient Management page's "Areas" tab (see PatientManagementTabs), a
 * pre-existing merge of what used to be separate sidebar pages — Figma's
 * mock predates that merge and shows it as its own page, so only the
 * panel's own visual treatment is matched here, not the page chrome
 * around it. */
export default function AreaDefsManager({ canEdit }: { canEdit: boolean }) {
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
    <div className="flex flex-col gap-8">
      {SESSION_TYPES.map(({ key, label }) => {
        const areas = areaDefs.filter((a) => a.sessionType === key);
        return (
          <section key={key} className="flex flex-col gap-3">
            <div className="flex items-end justify-between px-1">
              <h2 className="text-lg font-extrabold tracking-tight text-brown-900">{label}</h2>
              {canEdit && (
                <button
                  onClick={() => setEditing({ sessionType: key, area: null })}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-rust-600 transition-colors hover:text-rust-700"
                >
                  <Plus size={16} strokeWidth={3} />
                  Add Area
                </button>
              )}
            </div>

            {areas.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-beige-300 bg-surface px-5 py-4 text-sm text-brown-400">
                No custom areas yet, so the visit form falls back to a built-in default list.
              </div>
            ) : (
              <div className="overflow-hidden rounded-[16px] border border-beige-300 bg-surface shadow-soft">
                <ul className="flex flex-col divide-y divide-beige-300/60">
                  {areas.map((area) => (
                    <li
                      key={area.id}
                      className="group flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-beige-200/30"
                    >
                      <button
                        onClick={() => canEdit && setEditing({ sessionType: key, area })}
                        disabled={!canEdit}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left enabled:cursor-pointer"
                      >
                        <span className="text-sm font-extrabold text-brown-900">{area.name}</span>
                        <span className="text-sm font-semibold text-brown-400">
                          {area.defaultDurationMinutes ? `${area.defaultDurationMinutes} min` : "no default duration"}
                        </span>
                        <span className="text-xs text-brown-300">&bull;</span>
                        <span className="text-sm font-medium text-brown-400">
                          {area.gstApplicable ? "GST applicable" : "GST exempt"}
                        </span>
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => handleDelete(area.id)}
                          disabled={deletingId === area.id}
                          className="flex-shrink-0 rounded-md p-1.5 text-brown-300 transition-colors hover:bg-beige-200 hover:text-brown-900 disabled:opacity-50"
                          aria-label={`Remove ${area.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}

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
