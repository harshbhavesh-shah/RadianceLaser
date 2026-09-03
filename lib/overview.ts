import "server-only";
import { todayLocalStr } from "@/lib/packages";
import { timeToMinutes } from "@/lib/calendar";
import type { Appointment, Patient, Receipt, Visit } from "@/types";

/** Today's appointments, earliest first — the spine of the Dashboard's
 * Today section: everyone (doctor, owner, reception) starts their day by
 * looking at this same list, just with different actions available around it. */
export function computeTodayAppointments(appointments: Appointment[], todayStr: string = todayLocalStr()): Appointment[] {
  return [...appointments]
    .filter((a) => a.date === todayStr)
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

export type AlertKind = "package-low" | "package-expiring" | "contraindication" | "follow-up";

export interface OverviewAlert {
  kind: AlertKind;
  patientId: string;
  patientName: string;
  detail: string;
  href: string;
}

/** Visits with a follow-up date that's due (today or earlier) — the
 * "someone needs to check back with this patient" reminder set from
 * VisitFormModal. One alert per patient (their soonest-due follow-up, in
 * case more than one is somehow overdue at once), so this list doesn't
 * grow unbounded for a patient who's overdue on several old visits.
 * Currently unused by any page — kept as a ready-made building block for
 * whenever clinic-side (not patient-care) alerting gets a home again. */
export function computeFollowUpAlerts(
  visits: Visit[],
  patientsById: Map<string, Patient>,
  todayStr: string = todayLocalStr()
): OverviewAlert[] {
  const dueByPatient = new Map<string, Visit>();
  for (const v of visits) {
    if (!v.followUpDate || v.followUpDate > todayStr) continue;
    const existing = dueByPatient.get(v.patientId);
    if (!existing || v.followUpDate < existing.followUpDate!) {
      dueByPatient.set(v.patientId, v);
    }
  }

  const alerts: OverviewAlert[] = [];
  for (const v of dueByPatient.values()) {
    const patientName = patientsById.get(v.patientId)?.name || "Unknown patient";
    alerts.push({
      kind: "follow-up",
      patientId: v.patientId,
      patientName,
      detail: v.followUpNote ? `${v.followUpNote} — due ${v.followUpDate}` : `Follow-up due ${v.followUpDate}`,
      href: `/dashboard/patients/${v.patientId}`,
    });
  }
  return alerts;
}

export interface AppointmentPipelineMaps {
  // appointmentId -> the id of the Visit logged against it (first one, if
  // more than one somehow exists) — lets the UI know to offer "Generate
  // Receipt" instead of "Log Visit" for that appointment.
  visitIdByAppointmentId: Record<string, string>;
  // appointmentId -> true once a Receipt has been linked to it. Combined
  // with the map above, this is what the pipeline actions on
  // Today/Schedule/PatientMiniPanel branch on — see lib/pipeline.ts for the
  // client-side half (the auto-complete check itself).
  receiptedAppointmentIds: Record<string, true>;
}

export function computeAppointmentPipelineMaps(visits: Visit[], receipts: Receipt[]): AppointmentPipelineMaps {
  const visitIdByAppointmentId: Record<string, string> = {};
  for (const v of visits) {
    if (v.appointmentId && !visitIdByAppointmentId[v.appointmentId]) {
      visitIdByAppointmentId[v.appointmentId] = v.id;
    }
  }
  const receiptedAppointmentIds: Record<string, true> = {};
  for (const r of receipts) {
    if (r.appointmentId) receiptedAppointmentIds[r.appointmentId] = true;
  }
  return { visitIdByAppointmentId, receiptedAppointmentIds };
}
