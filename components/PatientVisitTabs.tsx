"use client";

import { useState } from "react";
import SessionTypePanel from "@/components/SessionTypePanel";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import type { Machine, Package, SessionType, StaffMember, Visit } from "@/types";

export default function PatientVisitTabs({
  clinicId,
  patientId,
  visits,
  packages,
  machines,
  staff,
}: {
  clinicId: string;
  patientId: string;
  visits: Visit[];
  packages: Package[];
  machines: Machine[];
  staff: StaffMember[];
}) {
  // Every session type the clinic has — the two built-ins plus any
  // clinic-defined machine types (e.g. "CO2 Laser") — each gets its own tab
  // here automatically, in the order they were created.
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const TABS: SessionType[] = Object.keys(SESSION_TYPE_CONFIG);
  const [active, setActive] = useState<SessionType>(TABS[0] || "qs");

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {TABS.map((type) => {
          const cfg = SESSION_TYPE_CONFIG[type];
          const isActive = active === type;
          return (
            <button
              key={type}
              onClick={() => setActive(type)}
              className={[
                "flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-surface text-brown-900 shadow-soft ring-1 ring-beige-300"
                  : "text-brown-600 hover:text-brown-900",
              ].join(" ")}
            >
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${cfg.badgeClassName}`}
              >
                {cfg.badgeText}
              </span>
              {cfg.label}
            </button>
          );
        })}
      </div>

      {TABS.map((type) => (
        <div key={type} className={active === type ? "block" : "hidden"}>
          <SessionTypePanel
            clinicId={clinicId}
            patientId={patientId}
            sessionType={type}
            initialVisits={visits.filter((v) => v.sessionType === type)}
            initialPackages={packages.filter((p) => p.sessionType === type)}
            machines={machines}
            staff={staff}
          />
        </div>
      ))}
    </div>
  );
}
