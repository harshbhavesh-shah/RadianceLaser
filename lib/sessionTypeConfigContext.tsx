"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { SessionTypeConfig } from "@/lib/sessionTypes";

type ConfigMap = Record<string, SessionTypeConfig>;

interface SessionTypeConfigContextValue {
  config: ConfigMap;
  addSessionType: (key: string, cfg: SessionTypeConfig) => void;
}

const SessionTypeConfigContext = createContext<SessionTypeConfigContextValue | null>(null);

/**
 * Makes the clinic's effective session-type config (built-in Q-Switch/LHR +
 * any clinic-defined machine types, e.g. "CO2 Laser") available to every
 * client component under /dashboard, without prop-drilling it through every
 * layer. Mounted once in app/dashboard/layout.tsx with the config computed
 * server-side; components read it via useSessionTypeConfig().
 *
 * Also exposes addSessionType so the "Add Machine Type" flow in Settings can
 * make a newly created type show up immediately (new tab on patient pages,
 * new option in the machine sub-type dropdown) without a full page reload.
 */
export function SessionTypeConfigProvider({
  initialConfig,
  children,
}: {
  initialConfig: ConfigMap;
  children: React.ReactNode;
}) {
  const [config, setConfig] = useState<ConfigMap>(initialConfig);

  const addSessionType = useCallback((key: string, cfg: SessionTypeConfig) => {
    setConfig((prev) => ({ ...prev, [key]: cfg }));
  }, []);

  const value = useMemo(() => ({ config, addSessionType }), [config, addSessionType]);

  return (
    <SessionTypeConfigContext.Provider value={value}>{children}</SessionTypeConfigContext.Provider>
  );
}

function useSessionTypeConfigContext(): SessionTypeConfigContextValue {
  const ctx = useContext(SessionTypeConfigContext);
  if (!ctx) {
    throw new Error("useSessionTypeConfig must be used within a SessionTypeConfigProvider");
  }
  return ctx;
}

/** The merged session-type config (built-in + clinic-defined), keyed by
 * SessionType — e.g. config.qs, config.co2. */
export function useSessionTypeConfig(): ConfigMap {
  return useSessionTypeConfigContext().config;
}

/** Registers a newly created clinic machine type so it shows up everywhere
 * in the current session immediately, without a reload. */
export function useAddSessionType(): (key: string, cfg: SessionTypeConfig) => void {
  return useSessionTypeConfigContext().addSessionType;
}
