"use client";

import { useEffect, useState } from "react";

/** Matches Tailwind's `md` breakpoint (768px) — used to branch behavior
 * between desktop (e.g. the appointment patient panel) and mobile (which
 * doesn't have room for it). Defaults to false on first render (before the
 * effect runs) so server-rendered HTML never assumes desktop. */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isDesktop;
}
