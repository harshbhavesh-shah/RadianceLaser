"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import FollowUpFormModal from "./FollowUpFormModal";
import { updateNoShowFollowUpAction, deleteNoShowFollowUpAction } from "@/app/dashboard/no-shows/actions";
import type { MessageTemplate, NoShowFollowUp, NoShowFollowUpKind } from "@/types";

const KIND_LABELS: Record<NoShowFollowUpKind, string> = {
  survey: "Survey",
  incentive: "Incentive",
  reminder: "Reminder",
  custom: "Custom",
};

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      disabled={disabled}
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? "bg-rust-700" : "bg-beige-300"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

/** The clinic's configurable no show follow-ups. Each toggle saves
 * immediately, no separate "Save" step. */
export default function FollowUpsSection({
  initialFollowUps,
  templates,
  isConnected,
  canEdit,
}: {
  initialFollowUps: NoShowFollowUp[];
  templates: MessageTemplate[]; // all clinic templates; filtered to no_show_followup below
  isConnected: boolean;
  canEdit: boolean;
}) {
  const [followUps, setFollowUps] = useState(initialFollowUps);
  const [editing, setEditing] = useState<NoShowFollowUp | null | "new">(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const followUpTemplates = templates.filter((t) => t.category === "no_show_followup");

  function handleSaved(followUp: NoShowFollowUp) {
    setFollowUps((prev) => {
      const exists = prev.some((f) => f.id === followUp.id);
      return exists ? prev.map((f) => (f.id === followUp.id ? followUp : f)) : [...prev, followUp];
    });
    setEditing(null);
  }

  async function handleToggle(followUp: NoShowFollowUp) {
    setTogglingId(followUp.id);
    const next = { ...followUp, enabled: !followUp.enabled };
    setFollowUps((prev) => prev.map((f) => (f.id === followUp.id ? next : f)));
    const result = await updateNoShowFollowUpAction(followUp.id, {
      name: followUp.name,
      kind: followUp.kind,
      templateId: followUp.templateId,
      offerText: followUp.offerText,
      enabled: next.enabled,
      delayHours: followUp.delayHours,
    });
    if ("error" in result) {
      setFollowUps((prev) => prev.map((f) => (f.id === followUp.id ? followUp : f))); // revert
      alert(result.error);
    }
    setTogglingId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this follow-up? It will stop sending immediately.")) return;
    setDeletingId(id);
    const result = await deleteNoShowFollowUpAction(id);
    if (result.error) {
      alert(result.error);
    } else {
      setFollowUps((prev) => prev.filter((f) => f.id !== id));
    }
    setDeletingId(null);
  }

  const editingFollowUp = editing && editing !== "new" ? editing : null;

  return (
    <div className="flex flex-col gap-4 rounded-[18px] bg-surface p-[26px] shadow-soft">
      <h2 className="text-lg font-extrabold text-brown-900">No Show Follow-Ups</h2>
      <p className="text-sm font-medium leading-relaxed text-brown-600">
        What happens automatically after a patient misses an appointment: a reason survey, a win-back offer,
        a reschedule nudge, or anything else you want to try. Turn any of them on or off, or add your own.
      </p>
      {canEdit && (
        <button
          onClick={() => setEditing("new")}
          className="w-full rounded-[10px] bg-rust-600 py-3 text-sm font-bold text-white transition-colors hover:bg-rust-700"
        >
          + New Follow-Up
        </button>
      )}

      {!isConnected && (
        <p className="rounded-xl bg-[#FBEEE9] px-4 py-3.5 text-[13px] font-semibold leading-relaxed text-rust-700">
          Connect WhatsApp in Communication settings before follow-ups can send.
        </p>
      )}

      {followUps.length === 0 ? (
        <p className="rounded-xl border border-dashed border-beige-300 py-5 text-center text-[13px] font-semibold leading-relaxed text-brown-400">
          No follow-ups yet. Try &quot;Ask why they missed it&quot; or a win-back offer to start.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {followUps.map((f) => {
            const template = templates.find((t) => t.id === f.templateId);
            return (
              <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-beige-300 px-4 py-3">
                <button
                  onClick={() => canEdit && setEditing(f)}
                  disabled={!canEdit}
                  className="min-w-0 flex-1 text-left enabled:cursor-pointer"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-bold text-brown-900">{f.name}</span>
                    <span className="flex-shrink-0 whitespace-nowrap rounded-full bg-beige-200 px-2 py-0.5 text-[10px] font-bold text-brown-600">
                      {KIND_LABELS[f.kind]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-semibold text-brown-400">
                    {f.delayHours < 24 ? `${f.delayHours}h` : `${f.delayHours / 24}d`} after the missed
                    appointment
                    {template ? ` · ${template.name}` : " · template deleted"}
                  </p>
                </button>
                <div className="flex flex-shrink-0 items-center gap-1">
                  {canEdit && (
                    <button
                      onClick={() => handleDelete(f.id)}
                      disabled={deletingId === f.id}
                      className="rounded p-1.5 text-brown-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      aria-label={`Delete ${f.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <Toggle
                    on={f.enabled}
                    onChange={() => handleToggle(f)}
                    disabled={!canEdit || togglingId === f.id || !isConnected}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing === "new" && (
        <FollowUpFormModal templates={followUpTemplates} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
      {editingFollowUp && (
        <FollowUpFormModal
          editing={editingFollowUp}
          templates={followUpTemplates}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
