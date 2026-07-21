"use client";

import { useState } from "react";
import PackageCard from "@/components/PackageCard";
import PackageFormModal from "@/components/PackageFormModal";
import VisitTimeline from "@/components/VisitTimeline";
import VisitFormModal from "@/components/VisitFormModal";
import { computePackageLedger } from "@/lib/packages";
import { SESSION_TYPE_CONFIG } from "@/lib/sessionTypes";
import type { Package, SessionType, Visit } from "@/types";

type ModalState =
  | { mode: "closed" }
  | { mode: "create"; presetPackageId?: string }
  | { mode: "edit"; visit: Visit };

export default function SessionTypePanel({
  clinicId,
  patientId,
  sessionType,
  initialVisits,
  initialPackages,
}: {
  clinicId: string;
  patientId: string;
  sessionType: SessionType;
  initialVisits: Visit[];
  initialPackages: Package[];
}) {
  const config = SESSION_TYPE_CONFIG[sessionType];
  const [visits, setVisits] = useState<Visit[]>(initialVisits);
  const [packages, setPackages] = useState<Package[]>(initialPackages);
  const [visitModal, setVisitModal] = useState<ModalState>({ mode: "closed" });
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [packagesExpanded, setPackagesExpanded] = useState(false);

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
    setPackagesExpanded(true);
  }

  return (
    <div>
      <div className="mb-6 rounded-xl bg-surface shadow-soft ring-1 ring-beige-300">
        <button
          onClick={() => setPackagesExpanded((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4"
        >
          <span className="flex items-center gap-2.5">
            <span
              className={`text-brown-400 transition-transform ${packagesExpanded ? "rotate-90" : ""}`}
            >
              ▸
            </span>
            <span className="text-sm font-semibold uppercase tracking-wide text-brown-600">
              Packages
            </span>
            {packages.length > 0 && (
              <span className="rounded-full bg-gold-100 px-2 py-0.5 text-xs font-medium text-gold-600">
                {activePackages.length} active
              </span>
            )}
          </span>
          <span className="text-xs font-medium text-brown-400">
            {packagesExpanded ? "Hide" : "Show"}
          </span>
        </button>

        {packagesExpanded && (
          <div className="border-t border-beige-300 px-5 py-4">
            <div className="mb-3 flex justify-end">
              <button
                onClick={() => setPackageModalOpen(true)}
                className="text-sm font-medium text-gold-600 hover:underline"
              >
                + New Package
              </button>
            </div>

            {packages.length === 0 ? (
              <p className="text-sm text-brown-400">No {config.label} packages purchased.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
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
        )}
      </div>

      <VisitTimeline
        sessionType={sessionType}
        visits={visits}
        onAddNew={() => setVisitModal({ mode: "create" })}
        onEdit={(visit) => setVisitModal({ mode: "edit", visit })}
      />

      {visitModal.mode !== "closed" && (
        <VisitFormModal
          clinicId={clinicId}
          patientId={patientId}
          sessionType={sessionType}
          visit={visitModal.mode === "edit" ? visitModal.visit : null}
          activePackages={activePackages}
          presetPackageId={visitModal.mode === "create" ? visitModal.presetPackageId : undefined}
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
          onClose={() => setPackageModalOpen(false)}
          onCreated={handlePackageCreated}
        />
      )}
    </div>
  );
}
