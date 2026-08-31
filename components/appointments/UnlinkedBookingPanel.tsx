"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import { formatTime12h, parseDateStr } from "@/lib/calendar";
import { quickCreatePatientAction } from "@/app/dashboard/appointments/actions";
import { linkPublicBookingAction } from "@/app/dashboard/appointments/appointmentActions";
import { STATUS_STYLES, STATUS_LABELS } from "./statusStyles";
import type { Appointment, Patient } from "@/types";

// Shown instead of PatientMiniPanel for appointments booked through the
// public marketing-site form (advancedskinclinic-new's appointment.njk),
// which write appointments with patientId: "" since an anonymous online
// booker isn't linked to any existing Patient record. There's nothing to
// look up yet, so this offers the one thing staff actually need: turn it
// into a real Patient (or attach it to an existing one with a matching
// phone number, same dedupe as the quick-add flow in AppointmentFormModal)
// so the full mini panel takes over from here on.
export default function UnlinkedBookingPanel({
  appointment,
  onClose,
  onLinked,
  onEditAppointment,
}: {
  appointment: Appointment;
  onClose: () => void;
  onLinked: (appointment: Appointment, patient: Patient) => void;
  onEditAppointment: () => void;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const apptCfg = SESSION_TYPE_CONFIG[appointment.sessionType];
  const apptStatusStyle = STATUS_STYLES[appointment.status];

  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLink() {
    setLinking(true);
    setError(null);
    try {
      const result = await quickCreatePatientAction(appointment.patientName, appointment.patientPhone);
      let patient: Patient;
      if (result.duplicate) {
        patient = { id: result.duplicate.id, name: result.duplicate.name, phone: result.duplicate.phone } as Patient;
      } else if (result.patient) {
        patient = result.patient;
      } else {
        setError(result.error || "Couldn't create a patient record. Please try again.");
        setLinking(false);
        return;
      }

      const linkResult = await linkPublicBookingAction(appointment, patient.id, patient.name, patient.phone);
      if ("error" in linkResult) {
        setError(linkResult.error);
        setLinking(false);
        return;
      }
      onLinked(linkResult.appointment, patient);
    } catch (err) {
      console.error("Failed to link booking to a patient:", err);
      setError("Something went wrong. Please try again.");
      setLinking(false);
    }
  }

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-xl bg-surface shadow-card ring-1 ring-beige-300">
      <div className="flex-shrink-0 border-b border-beige-300 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-medium text-brown-900">
              {appointment.patientName}
            </div>
            <span className="mt-1 inline-block rounded-full bg-beige-200 px-2 py-0.5 text-[10px] font-medium text-brown-600">
              Online booking · not linked
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-md p-1 text-brown-400 hover:bg-beige-200 hover:text-brown-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-3 text-sm text-brown-600">{appointment.patientPhone}</div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="rounded-lg border border-beige-300 bg-canvas p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${apptCfg.badgeClassName}`}>
              {apptCfg.badgeText}
            </span>
            <span
              className={`ml-auto flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${apptStatusStyle.bg} ${apptStatusStyle.text}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${apptStatusStyle.dot}`} />
              {STATUS_LABELS[appointment.status]}
            </span>
          </div>
          <div className="text-sm font-medium text-brown-900">
            {parseDateStr(appointment.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {" · "}
            {formatTime12h(appointment.time)}
          </div>

          <div className="mt-2 space-y-1.5">
            <button
              onClick={handleLink}
              disabled={linking}
              className="w-full rounded-md bg-brown-900 py-1.5 text-xs font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
            >
              {linking ? "Linking…" : "Create / Link Patient Record"}
            </button>
            <button
              onClick={onEditAppointment}
              className="w-full rounded-md border border-gold-500 py-1.5 text-xs font-medium text-gold-600 transition-colors hover:bg-gold-100"
            >
              Edit This Appointment
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
        </div>

        <p className="mt-4 text-xs text-brown-400">
          This appointment came in through the website's booking form and isn't linked to a patient
          record yet. Linking it will match an existing patient by phone number, or create a new one.
        </p>
      </div>
    </aside>
  );
}
