"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import PackageTypeFormModal from "./PackageTypeFormModal";
import { deletePackageTypeDefAction } from "@/app/dashboard/packages/actions";
import type { PackageTypeDef, SessionType } from "@/types";
import type { SessionTypeConfig } from "@/lib/sessionTypes";

type EditingState = { sessionType: SessionType; def: PackageTypeDef | null } | null;

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function PackageTypesManager({
  initialPackageTypeDefs,
  sessionTypeConfig,
  canEdit,
}: {
  initialPackageTypeDefs: PackageTypeDef[];
  sessionTypeConfig: Record<string, SessionTypeConfig>;
  canEdit: boolean;
}) {
  const [defs, setDefs] = useState(initialPackageTypeDefs);
  const [editing, setEditing] = useState<EditingState>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleSaved(def: PackageTypeDef) {
    setDefs((prev) => {
      const isNew = !prev.some((d) => d.id === def.id);
      return isNew ? [...prev, def] : prev.map((d) => (d.id === def.id ? def : d));
    });
    setEditing(null);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove "${name}"? Packages already sold from it are unaffected. This only removes the preset.`)) {
      return;
    }
    setDeletingId(id);
    const result = await deletePackageTypeDefAction(id);
    if (result.error) {
      alert(result.error);
    } else {
      setDefs((prev) => prev.filter((d) => d.id !== id));
    }
    setDeletingId(null);
  }

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="space-y-6">
        {Object.entries(sessionTypeConfig).map(([key, config]) => {
          const sessionType = key as SessionType;
          const typeDefs = defs.filter((d) => d.sessionType === sessionType);
          return (
            <div key={sessionType}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-brown-700">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${config.badgeClassName}`}>
                    {config.badgeText}
                  </span>
                  {config.label}
                </h3>
                {canEdit && (
                  <button
                    onClick={() => setEditing({ sessionType, def: null })}
                    className="text-xs font-medium text-gold-600 hover:underline"
                  >
                    + Add Package Type
                  </button>
                )}
              </div>

              {typeDefs.length === 0 ? (
                <p className="rounded-lg border border-dashed border-beige-300 px-4 py-3 text-xs text-brown-400">
                  No package presets yet for {config.label}.
                </p>
              ) : (
                <div className="space-y-2">
                  {typeDefs.map((def) => (
                    <div
                      key={def.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-beige-300 px-4 py-2.5"
                    >
                      <button
                        onClick={() => canEdit && setEditing({ sessionType, def })}
                        disabled={!canEdit}
                        className="min-w-0 flex-1 text-left enabled:cursor-pointer"
                      >
                        <span className="text-sm font-medium text-brown-900">{def.name}</span>
                        <span className="ml-2 text-xs text-brown-400">
                          {def.totalSessions} sessions · {formatCurrency(def.suggestedAmount)}
                        </span>
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => handleDelete(def.id, def.name)}
                          disabled={deletingId === def.id}
                          className="flex-shrink-0 rounded p-1.5 text-brown-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          aria-label={`Remove ${def.name}`}
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
        <PackageTypeFormModal
          sessionType={editing.sessionType}
          sessionTypeLabel={sessionTypeConfig[editing.sessionType]?.label || editing.sessionType}
          editing={editing.def}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
