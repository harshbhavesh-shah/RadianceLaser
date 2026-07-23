import "server-only";
import { computePackageLedger, todayLocalStr } from "@/lib/packages";
import { timeToMinutes } from "@/lib/calendar";
import type { Appointment, Package, Patient, Receipt, Visit } from "@/types";

/** Today's appointments, earliest first — the spine of the Overview
 * "command center": everyone (doctor, owner, reception) starts their day by
 * looking at this same list, just with different actions available around it. */
export function computeTodayAppointments(appointments: Appointment[], todayStr: string = todayLocalStr()): Appointment[] {
  return [...appointments]
    .filter((a) => a.date === todayStr)
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

export type AlertKind = "package-low" | "package-expiring" | "contraindication";

export interface OverviewAlert {
  kind: AlertKind;
  patientId: string;
  patientName: string;
  detail: string;
  href: string;
}

const EXPIRY_WARNING_DAYS = 14;
const LOW_SESSIONS_THRESHOLD = 2;

/** Active packages worth flagging on Overview: running low on sessions, or
 * expiring soon — both are "someone needs to follow up with this patient"
 * situations, which is exactly what a morning glance should surface. */
export function computePackageAlerts(
  packages: Package[],
  visits: Visit[],
  patientsById: Map<string, Patient>,
  todayStr: string = todayLocalStr()
): OverviewAlert[] {
  const warningCutoff = new Date(`${todayStr}T00:00:00`);
  warningCutoff.setDate(warningCutoff.getDate() + EXPIRY_WARNING_DAYS);
  const warningCutoffStr = `${warningCutoff.getFullYear()}-${String(warningCutoff.getMonth() + 1).padStart(2, "0")}-${String(warningCutoff.getDate()).padStart(2, "0")}`;

  const alerts: OverviewAlert[] = [];

  for (const pkg of packages) {
    const patientVisits = visits.filter((v) => v.patientId === pkg.patientId);
    const ledger = computePackageLedger(pkg, patientVisits);
    if (ledger.status !== "active") continue;

    const patientName = patientsById.get(pkg.patientId)?.name || "Unknown patient";
    const href = `/dashboard/patients/${pkg.patientId}`;

    if (pkg.expiryDate && pkg.expiryDate <= warningCutoffStr) {
      alerts.push({
        kind: "package-expiring",
        patientId: pkg.patientId,
        patientName,
        detail: `${pkg.label} expires ${pkg.expiryDate}`,
        href,
      });
    } else if (ledger.sessionsRemaining <= LOW_SESSIONS_THRESHOLD) {
      alerts.push({
        kind: "package-low",
        patientId: pkg.patientId,
        patientName,
        detail: `${pkg.label} — ${ledger.sessionsRemaining} session${ledger.sessionsRemaining === 1 ? "" : "s"} left`,
        href,
      });
    }
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

/** Patients with a contraindication note who are coming in today — a
 * clinically relevant heads-up that's easy to miss buried on the patient
 * record, but matters most exactly on the day they're being treated. */
export function computeContraindicationAlerts(
  todayAppointments: Appointment[],
  patientsById: Map<string, Patient>
): OverviewAlert[] {
  const alerts: OverviewAlert[] = [];
  const seen = new Set<string>();

  for (const appt of todayAppointments) {
    if (seen.has(appt.patientId)) continue;
    const patient = patientsById.get(appt.patientId);
    if (!patient?.contraindications) continue;
    seen.add(appt.patientId);
    alerts.push({
      kind: "contraindication",
      patientId: appt.patientId,
      patientName: patient.name,
      detail: patient.contraindications,
      href: `/dashboard/patients/${appt.patientId}`,
    });
  }

  return alerts;
}
