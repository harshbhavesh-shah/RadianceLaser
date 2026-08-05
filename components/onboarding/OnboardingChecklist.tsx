"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Compass, X } from "lucide-react";
import { dismissOnboardingAction } from "@/app/dashboard/actions";
import ProductTour from "./ProductTour";
import type { UserRole } from "@/types";

interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  href?: string;
  linkLabel?: string;
}

/** Setup checklist for a brand-new clinic, shown on the Owner's Today page
 * until they dismiss it (see StaffMember.onboardingDismissed). Step
 * completion is derived live from real clinic data rather than stored
 * separately — a clinic with patients already has "Add your first
 * patient" checked off with no extra bookkeeping — except the tour itself,
 * which has no natural data signal and so gets its own stored flag (see
 * ProductTour.tsx and StaffMember.tourCompleted). */
export default function OnboardingChecklist({
  role,
  tourCompleted,
  hasPatients,
  hasVisits,
  hasAppointments,
  hasTeam,
}: {
  role: UserRole;
  tourCompleted: boolean;
  hasPatients: boolean;
  hasVisits: boolean;
  hasAppointments: boolean;
  hasTeam: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourJustCompleted, setTourJustCompleted] = useState(false);

  const items: ChecklistItem[] = [
    { key: "tour", label: "Take a 60-second tour of RadianceLaser", done: tourCompleted || tourJustCompleted },
    {
      key: "patient",
      label: "Add your first patient",
      done: hasPatients,
      href: "/dashboard/patients/new",
      linkLabel: "Add patient",
    },
    {
      key: "visit",
      label: "Log a treatment session",
      done: hasVisits,
      href: "/dashboard/patients",
      linkLabel: "Go to Patients",
    },
    {
      key: "appointment",
      label: "Book an appointment",
      done: hasAppointments,
      href: "/dashboard/appointments",
      linkLabel: "Go to Schedule",
    },
    ...(role === "owner"
      ? [
          {
            key: "team",
            label: "Invite your team",
            done: hasTeam,
            href: "/dashboard/settings",
            linkLabel: "Go to Settings",
          },
        ]
      : []),
  ];

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;

  async function handleDismiss() {
    setDismissed(true);
    await dismissOnboardingAction();
  }

  if (dismissed) return null;

  return (
    <>
      <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-medium text-brown-900">
              {allDone ? "You're all set!" : "Get set up"}
            </h2>
            <p className="mt-1 text-sm text-brown-400">
              {allDone
                ? "Every step below is done — you can close this whenever you like."
                : `${doneCount} of ${items.length} done`}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss checklist"
            className="flex-shrink-0 rounded p-1 text-brown-400 hover:bg-beige-200 hover:text-brown-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-3 mb-4 h-1.5 w-full overflow-hidden rounded-full bg-beige-200">
          <div
            className="h-full rounded-full bg-gold-500 transition-all duration-500"
            style={{ width: `${(doneCount / items.length) * 100}%` }}
          />
        </div>

        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.key}
              className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${
                item.done ? "bg-beige-200/40" : "bg-canvas"
              }`}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                    item.done ? "bg-gold-500 text-white" : "border border-beige-300 text-transparent"
                  }`}
                >
                  <Check size={12} strokeWidth={3} />
                </span>
                <span className={`text-sm ${item.done ? "text-brown-400 line-through" : "text-brown-800"}`}>
                  {item.label}
                </span>
              </span>
              {!item.done &&
                (item.key === "tour" ? (
                  <button
                    onClick={() => setTourOpen(true)}
                    className="flex flex-shrink-0 items-center gap-1 text-sm font-medium text-gold-600 hover:underline"
                  >
                    <Compass size={14} />
                    Start
                  </button>
                ) : (
                  item.href && (
                    <Link href={item.href} className="flex-shrink-0 text-sm font-medium text-gold-600 hover:underline">
                      {item.linkLabel}
                    </Link>
                  )
                ))}
            </li>
          ))}
        </ul>
      </div>

      {tourOpen && (
        <ProductTour
          role={role}
          onClose={() => {
            setTourOpen(false);
            setTourJustCompleted(true);
          }}
        />
      )}
    </>
  );
}
