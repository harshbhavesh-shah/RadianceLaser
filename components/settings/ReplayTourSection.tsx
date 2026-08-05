"use client";

import { useState } from "react";
import { Compass } from "lucide-react";
import ProductTour from "@/components/onboarding/ProductTour";
import type { UserRole } from "@/types";

/** Lets someone re-open the guided tour on demand — the onboarding
 * checklist's welcome step tells first-time users they can find it here.
 * ProductTour itself (re)marks StaffMember.tourCompleted on close, but
 * that's harmlessly idempotent for a replay — it only matters the first
 * time, to decide whether the checklist still offers to auto-start it. */
export default function ReplayTourSection({ role }: { role: UserRole }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-brown-900">Product Tour</h2>
          <p className="mt-1 text-sm text-brown-400">Replay the guided walkthrough of the sidebar.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex flex-shrink-0 items-center gap-2 rounded-md border border-beige-300 px-4 py-2 text-sm font-medium text-brown-700 transition-colors hover:border-gold-500 hover:text-gold-600"
        >
          <Compass size={16} />
          Replay Tour
        </button>
      </div>

      {open && <ProductTour role={role} onClose={() => setOpen(false)} />}
    </div>
  );
}
