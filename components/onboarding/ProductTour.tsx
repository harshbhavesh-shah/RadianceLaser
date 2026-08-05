"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import { completeTourAction } from "@/app/dashboard/actions";
import { useSidebarCollapse } from "@/components/SidebarContext";
import type { UserRole } from "@/types";

interface TourStep {
  // null = a centered welcome/closing card with no spotlight, used for the
  // very first step only — everything after that anchors to a real sidebar
  // item so the tour teaches actual navigation, not just a slideshow.
  target: string | null;
  title: string;
  body: string;
}

function buildSteps(role: UserRole): TourStep[] {
  const steps: TourStep[] = [
    {
      target: null,
      title: "Welcome to RadianceLaser",
      body: "A 60-second look at where everything lives — you can skip this anytime and pick it up later from Settings.",
    },
    {
      target: "nav-/dashboard",
      title: "Today",
      body: "Your daily command center — today's appointments, anything that needs attention, and (for owners) a quick business snapshot.",
    },
    {
      target: "nav-/dashboard/appointments",
      title: "Schedule",
      body: "Book and manage appointments here. Each booking flows straight through to logging the visit and generating a receipt.",
    },
    {
      target: "nav-/dashboard/patients",
      title: "Patients",
      body: "Your full patient roster — search by name, phone, or patient ID, and open any record to see their whole history.",
    },
    {
      target: "nav-/dashboard/documents",
      title: "Documents",
      body: "Consent forms and receipts, generated and signed digitally — no printer required.",
    },
  ];
  if (role === "owner" || role === "doctor") {
    steps.push({
      target: "nav-/dashboard/analytics",
      title: "Analytics",
      body: "Revenue trends, treatment-type breakdowns, and machine usage — computed live from actual visits, never a stale export.",
    });
  }
  steps.push({
    target: "nav-/dashboard/settings",
    title: "Settings",
    body:
      role === "owner"
        ? "Your clinic profile, staff, machines, billing, and data import all live here."
        : "Your account preferences and security settings live here.",
  });
  return steps;
}

/** Guided walkthrough of the sidebar, auto-launched once per person (see
 * StaffMember.tourCompleted) from the onboarding checklist. Forces the
 * sidebar open for the duration via SidebarContext's temporary override —
 * the same mechanism used to fix the "sidebar stuck collapsed" bug — so
 * every step has a labeled, spotlight-able target regardless of the
 * viewer's saved collapse preference. */
export default function ProductTour({ role, onClose }: { role: UserRole; onClose: () => void }) {
  const { setTemporaryOverride } = useSidebarCollapse();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const steps = buildSteps(role);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  useEffect(() => {
    setTemporaryOverride(false);
    return () => setTemporaryOverride(null);
  }, [setTemporaryOverride]);

  useEffect(() => {
    if (!step.target) {
      setRect(null);
      return;
    }
    // The sidebar's collapse↔expand width transition (300ms, see
    // Sidebar.tsx) needs to finish before measuring, or the highlight box
    // gets positioned against the pre-transition layout.
    const measure = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      const box = el?.getBoundingClientRect();
      // Below the sidebar's md breakpoint (see Sidebar.tsx) the desktop nav
      // is `display: none` regardless of the temporary-expand override
      // above — that's a media query, not something JS state can force —
      // so its rect collapses to zero-size. Falling back to the centered
      // card instead of spotlighting an invisible element avoids pinning
      // the tooltip to a meaningless (0,0) corner on narrow viewports.
      setRect(box && box.width > 0 && box.height > 0 ? box : null);
    };
    const timer = setTimeout(measure, 320);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", measure);
    };
  }, [stepIndex, step.target]);

  async function finish() {
    onClose();
    await completeTourAction();
  }

  function next() {
    if (isLast) {
      finish();
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  const tooltipStyle: CSSProperties = rect
    ? { top: Math.min(Math.max(16, rect.top), window.innerHeight - 220), left: rect.right + 16 }
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <div className="fixed inset-0 z-[999]">
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-lg transition-all duration-300"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(44, 29, 20, 0.7)",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-brown-900/70" />
      )}

      <div
        className="fixed w-[300px] max-w-[calc(100vw-2rem)] rounded-xl bg-surface p-5 shadow-2xl ring-1 ring-beige-300"
        style={tooltipStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-medium text-brown-900">{step.title}</h3>
          <button
            onClick={finish}
            aria-label="Skip tour"
            className="flex-shrink-0 rounded p-1 text-brown-400 hover:bg-beige-200 hover:text-brown-700"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mt-2 text-sm text-brown-600">{step.body}</p>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-brown-400">
            {stepIndex + 1} / {steps.length}
          </span>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                onClick={() => setStepIndex((i) => i - 1)}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-brown-700 hover:bg-beige-200"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="rounded-md bg-brown-900 px-3 py-1.5 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
