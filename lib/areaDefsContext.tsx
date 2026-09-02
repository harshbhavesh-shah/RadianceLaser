"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { AreaDef } from "@/types";

interface AreaDefsContextValue {
  areaDefs: AreaDef[];
  addAreaDef: (def: AreaDef) => void;
  updateAreaDefInList: (def: AreaDef) => void;
  removeAreaDef: (id: string) => void;
}

const AreaDefsContext = createContext<AreaDefsContextValue | null>(null);

/**
 * Makes a clinic's treatment-area list (Settings → Treatment Areas)
 * available to every client component under /dashboard, same pattern as
 * SessionTypeConfigProvider — mounted once in app/dashboard/layout.tsx with
 * the list fetched server-side, so both the Settings page and
 * VisitFormModal's Area dropdown read the same live list via useAreaDefs()
 * without a page reload after an edit.
 */
export function AreaDefsProvider({
  initialAreaDefs,
  children,
}: {
  initialAreaDefs: AreaDef[];
  children: React.ReactNode;
}) {
  const [areaDefs, setAreaDefs] = useState<AreaDef[]>(initialAreaDefs);

  const addAreaDef = useCallback((def: AreaDef) => {
    setAreaDefs((prev) => [...prev, def]);
  }, []);

  const updateAreaDefInList = useCallback((def: AreaDef) => {
    setAreaDefs((prev) => prev.map((d) => (d.id === def.id ? def : d)));
  }, []);

  const removeAreaDef = useCallback((id: string) => {
    setAreaDefs((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const value = useMemo(
    () => ({ areaDefs, addAreaDef, updateAreaDefInList, removeAreaDef }),
    [areaDefs, addAreaDef, updateAreaDefInList, removeAreaDef]
  );

  return <AreaDefsContext.Provider value={value}>{children}</AreaDefsContext.Provider>;
}

function useAreaDefsContext(): AreaDefsContextValue {
  const ctx = useContext(AreaDefsContext);
  if (!ctx) {
    throw new Error("useAreaDefs must be used within an AreaDefsProvider");
  }
  return ctx;
}

/** The clinic's full treatment-area list, across every session type —
 * filter by `.sessionType` for a single form's dropdown (see
 * components/VisitFormModal.tsx). */
export function useAreaDefs(): AreaDef[] {
  return useAreaDefsContext().areaDefs;
}

/** Add/update/remove actions so Settings → Treatment Areas can keep every
 * open VisitFormModal's Area dropdown in sync immediately, without a
 * reload. */
export function useAreaDefsActions(): Pick<AreaDefsContextValue, "addAreaDef" | "updateAreaDefInList" | "removeAreaDef"> {
  const { addAreaDef, updateAreaDefInList, removeAreaDef } = useAreaDefsContext();
  return { addAreaDef, updateAreaDefInList, removeAreaDef };
}
