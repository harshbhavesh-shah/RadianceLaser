"use client";

import { useState } from "react";
import PackageCard from "@/components/PackageCard";
import PackageFormModal from "@/components/PackageFormModal";
import VisitTimeline from "@/components/VisitTimeline";
import VisitFormModal from "@/components/VisitFormModal";
import { computePackageLedger } from "@/lib/packages";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import type { Machine, Package, PackageTypeDef, SessionType, StaffMember, Visit } from "@/types";

type ModalState =
  | { mode: "closed" }
  | { mode: "create"; presetPackageId?: string; presetAppointmentId?: string }
  | { mode: "edit"; visit: Visit };

export default function SessionTypePanel({
  clinicId,
  patientId,
  sessionType,
  initialVisits,
  initialPackages,
  packageTypeDefs,
  machines,
  staff,
  autoOpenAppointmentId,
}: {
  clinicId: string;
  patientId: string;
  sessionType: SessionType;
  initialVisits: Visit[];
  initialPackages: Package[];
  // This session type's package presets (see app/dashboard/packages) — the
  // "New Package" form's optional shortcut picker.
  packageTypeDefs: PackageTypeDef[];
  machines: Machine[];
  staff: StaffMember[];
  // Set only on the tab a "Log Visit" deep link targets — opens the visit
  // form pre-linked to that appointment as soon as this tab is visible.
  autoOpenAppointmentId?: string;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const config = SESSION_TYPE_CONFIG[sessionType];
  const [visits, setVisits] = useState<Visit[]>(initialVisits);
  const [packages, setPackages] = useState<Package[]>(initialPackages);
  const [visitModal, setVisitModal] = useState<ModalState>(
    autoOpenAppointmentId ? { mode: "create", presetAppointmentId: autoOpenAppointmentId } : { mode: "closed" }
  );
  const [packageModalOpen, setPackageModalOpen] = useState(false);

  const activePackages = packages.filter(
    (p) => computePackageLedger(p, visits).status === "active"
  );

  function handleVisitSaved(saved: Visit) {
    setVisits((prev) => {
      const exists = prev.some((v) => v.id === saved.id);
      return exists ? prev.map((v) => (v.id === saved.id ? saved : v)) : [saved, ...prev];
    });
    setVisitModal({ mode: "closed" });
  }

  function handleVisitDeleted(visitId: string) {
    setVisits((prev) => prev.filter((v) => v.id !== visitId));
    setVisitModal({ mode: "closed" });
  }

  function handlePackageCreated(pkg: Package) {
    setPackages((prev) => [pkg, ...prev]);
    setPackageModalOpen(false);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
      <VisitTimeline
        sessionType={sessionType}
        visits={visits}
        onAddNew={() => setVisitModal({ mode: "create" })}
        onEdit={(visit) => setVisitModal({ mode: "edit", visit })}
      />

      {/* Active Packages — always visible beside the timeline, matching the
          new design's Treatment History layout, rather than the collapsed
          accordion this used to be. Scoped to this session type only, same
          as the timeline next to it — a package is always tied to one
          type, so there's nothing to unify across tabs. */}
      <div className="rounded-2xl border border-beige-300 bg-surface shadow-soft">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm font-semibold text-brown-900">Active Packages</span>
          <button
            onClick={() => setPackageModalOpen(true)}
            className="text-xs font-medium text-rust-700 hover:underline"
          >
            + New Package
          </button>
        </div>
        <div className="space-y-4 border-t border-beige-300 px-5 py-4">
          {packages.length === 0 ? (
            <p className="text-sm text-brown-400">No {config.label} packages purchased.</p>
          ) : (
            packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                visits={visits}
                onRedeem={() => setVisitModal({ mode: "create", presetPackageId: pkg.id })}
              />
            ))
          )}
        </div>
      </div>

      {visitModal.mode !== "closed" && (
        <VisitFormModal
          clinicId={clinicId}
          patientId={patientId}
          sessionType={sessionType}
          visit={visitModal.mode === "edit" ? visitModal.visit : null}
          activePackages={activePackages}
          presetPackageId={visitModal.mode === "create" ? visitModal.presetPackageId : undefined}
          appointmentId={visitModal.mode === "create" ? visitModal.presetAppointmentId : undefined}
          machines={machines}
          staff={staff}
          onClose={() => setVisitModal({ mode: "closed" })}
          onSaved={handleVisitSaved}
          onDeleted={handleVisitDeleted}
        />
      )}

      {packageModalOpen && (
        <PackageFormModal
          clinicId={clinicId}
          patientId={patientId}
          sessionType={sessionType}
          packageTypeDefs={packageTypeDefs}
          onClose={() => setPackageModalOpen(false)}
          onCreated={handlePackageCreated}
        />
      )}
    </div>
  );
}
