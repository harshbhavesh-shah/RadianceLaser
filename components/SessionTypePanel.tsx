"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
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

// Lets the shared "+ Log New Visit" button that now lives in the filter row
// (see PatientVisitTabs) trigger the create modal on whichever session
// type's panel is currently active, even though every panel stays mounted
// (just hidden) so a "Log Visit" deep link can still land on the right one.
export type SessionTypePanelHandle = {
  openCreate: () => void;
};

const SessionTypePanel = forwardRef<
  SessionTypePanelHandle,
  {
    clinicId: string;
    patientId: string;
    sessionType: SessionType;
    initialVisits: Visit[];
    initialPackages: Package[];
    // This session type's package presets (see app/dashboard/packages) —
    // the "New Package" form's optional shortcut picker.
    packageTypeDefs: PackageTypeDef[];
    machines: Machine[];
    staff: StaffMember[];
    // Set only on the tab a "Log Visit" deep link targets — opens the visit
    // form pre-linked to that appointment as soon as this tab is visible.
    autoOpenAppointmentId?: string;
  }
>(function SessionTypePanel(
  { clinicId, patientId, sessionType, initialVisits, initialPackages, packageTypeDefs, machines, staff, autoOpenAppointmentId },
  ref
) {
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

  useImperativeHandle(ref, () => ({
    openCreate: () => setVisitModal({ mode: "create" }),
  }));

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
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <div className="flex-1">
        <VisitTimeline sessionType={sessionType} visits={visits} onEdit={(visit) => setVisitModal({ mode: "edit", visit })} />
      </div>

      {/* Active Packages — always visible beside the timeline. Scoped to
          this session type only, same as the timeline next to it — a
          package is always tied to one type, so there's nothing to unify
          across tabs. */}
      <div className="flex w-full flex-col gap-4 rounded-[18px] bg-surface p-6 shadow-soft lg:w-[320px] lg:flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-base font-extrabold text-brown-900">Active Packages</span>
          <button
            onClick={() => setPackageModalOpen(true)}
            className="whitespace-nowrap text-[13px] font-bold text-rust-600 hover:text-rust-700"
          >
            + New Package
          </button>
        </div>
        {packages.length === 0 ? (
          <p className="text-sm font-semibold text-brown-400">No {config.label} packages purchased.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                visits={visits}
                onRedeem={() => setVisitModal({ mode: "create", presetPackageId: pkg.id })}
              />
            ))}
          </div>
        )}
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
});

export default SessionTypePanel;
