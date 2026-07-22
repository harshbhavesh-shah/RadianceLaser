"use client";

import { useState } from "react";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import MachineFormModal from "./MachineFormModal";
import type { Machine, MachineStatus } from "@/types";

const STATUS_STYLES: Record<MachineStatus, string> = {
  active: "bg-green-50 text-green-700",
  maintenance: "bg-gold-100 text-gold-600",
  retired: "bg-beige-300 text-brown-500",
};

export default function MachinesSection({
  clinicId,
  initialMachines,
  canEdit,
}: {
  clinicId: string;
  initialMachines: Machine[];
  canEdit: boolean;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const [machines, setMachines] = useState<Machine[]>(initialMachines);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  function openCreate() {
    setEditingMachine(null);
    setModalOpen(true);
  }

  function openEdit(machine: Machine) {
    setEditingMachine(machine);
    setModalOpen(true);
  }

  function handleSaved(saved: Machine) {
    setMachines((prev) => {
      const exists = prev.some((m) => m.id === saved.id);
      return exists ? prev.map((m) => (m.id === saved.id ? saved : m)) : [...prev, saved];
    });
    setModalOpen(false);
  }

  function handleDeleted(id: string) {
    setMachines((prev) => prev.filter((m) => m.id !== id));
    setModalOpen(false);
  }

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-medium text-brown-900">Treatment Machines</h2>
          <p className="mt-0.5 text-xs text-brown-400">
            A physical unit at an existing machine type — e.g. a second Q-Switch. To add a whole
            new major machine type, use &quot;Machine Types&quot; below.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex-shrink-0 rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
          >
            + Add Machine
          </button>
        )}
      </div>

      {machines.length === 0 ? (
        <p className="text-sm text-brown-400">No machines registered yet.</p>
      ) : (
        <div className="space-y-2">
          {machines.map((machine) => {
            const cfg = SESSION_TYPE_CONFIG[machine.sessionType] ?? {
              badgeText: "?",
              badgeClassName: "bg-beige-300 text-brown-500",
            };
            return (
              <button
                key={machine.id}
                onClick={() => canEdit && openEdit(machine)}
                disabled={!canEdit}
                className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border border-beige-300 px-4 py-3 text-left transition-colors enabled:hover:bg-gold-100/40 disabled:cursor-default"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${cfg.badgeClassName}`}
                  >
                    {cfg.badgeText}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-brown-900">{machine.name}</div>
                    {machine.serialNumber && (
                      <div className="text-xs text-brown-400">SN: {machine.serialNumber}</div>
                    )}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[machine.status]}`}
                >
                  {machine.status}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <MachineFormModal
          clinicId={clinicId}
          machine={editingMachine}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
