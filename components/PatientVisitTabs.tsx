"use client";

import { useRef, useState } from "react";
import SessionTypePanel, { type SessionTypePanelHandle } from "@/components/SessionTypePanel";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import { pickableSessionTypeEntries } from "@/lib/sessionTypes";
import type { Machine, Package, PackageTypeDef, SessionType, StaffMember, Visit } from "@/types";

export default function PatientVisitTabs({
  clinicId,
  patientId,
  visits,
  packages,
  packageTypeDefs,
  machines,
  staff,
  initialActiveTab,
  autoOpenVisitForAppointmentId,
}: {
  clinicId: string;
  patientId: string;
  visits: Visit[];
  packages: Package[];
  packageTypeDefs: PackageTypeDef[];
  machines: Machine[];
  staff: StaffMember[];
  // Both set together when arriving via a "Log Visit" deep link from an
  // appointment (see components/overview/TodayAgenda.tsx) — opens straight
  // to the right tab with the visit form already open and pre-linked.
  initialActiveTab?: SessionType;
  autoOpenVisitForAppointmentId?: string;
}) {
  // Every pickable session type the clinic has — the built-in LHR plus any
  // clinic-defined machine types (e.g. "CO2 Laser") — each gets its own tab
  // here automatically, in the order they were created. Not "consultation"
  // — it's never a real treatment tab (see lib/sessionTypes.ts).
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const TABS: SessionType[] = pickableSessionTypeEntries(SESSION_TYPE_CONFIG).map(([key]) => key);
  const [active, setActive] = useState<SessionType>(
    (initialActiveTab && SESSION_TYPE_CONFIG[initialActiveTab] ? initialActiveTab : TABS[0]) || "lhr"
  );
  // One handle per session type — every panel stays mounted (just hidden)
  // so a "Log Visit" deep link can still land on the right one, so the
  // shared "+ Log New Visit" button below needs to reach whichever panel
  // is currently active rather than a single ref.
  const panelRefs = useRef<Partial<Record<SessionType, SessionTypePanelHandle>>>({});

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          {TABS.map((type) => {
            const cfg = SESSION_TYPE_CONFIG[type];
            const isActive = active === type;
            return (
              <button
                key={type}
                onClick={() => setActive(type)}
                className={[
                  "flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full py-2 pl-2 pr-4 text-sm font-bold transition-colors",
                  isActive
                    ? "bg-beige-200 text-rust-700"
                    : "border border-beige-300 bg-surface text-brown-600 hover:border-rust-600/40",
                ].join(" ")}
              >
                <span
                  className={`rounded-md px-1.5 py-[3px] text-[10px] font-extrabold tracking-wide ${cfg.badgeClassName}`}
                >
                  {cfg.badgeText}
                </span>
                {cfg.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => panelRefs.current[active]?.openCreate()}
          className="flex-shrink-0 rounded-[10px] bg-rust-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-rust-700"
        >
          + Log New Visit
        </button>
      </div>

      {TABS.map((type) => (
        <div key={type} className={active === type ? "block" : "hidden"}>
          <SessionTypePanel
            ref={(handle) => {
              panelRefs.current[type] = handle ?? undefined;
            }}
            clinicId={clinicId}
            patientId={patientId}
            sessionType={type}
            initialVisits={visits.filter((v) => v.sessionType === type)}
            initialPackages={packages.filter((p) => p.sessionType === type)}
            packageTypeDefs={packageTypeDefs.filter((d) => d.sessionType === type)}
            machines={machines}
            staff={staff}
            autoOpenAppointmentId={type === initialActiveTab ? autoOpenVisitForAppointmentId : undefined}
          />
        </div>
      ))}
    </div>
  );
}
