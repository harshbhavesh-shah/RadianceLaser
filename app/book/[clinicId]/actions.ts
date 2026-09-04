"use server";

import { getClinic } from "@/lib/db/clinics";
import { getClinicAccess } from "@/lib/subscription";
import { getClinicSessionTypeDefs } from "@/lib/db/sessionTypeDefs";
import { buildSessionTypeConfig } from "@/lib/sessionTypes";
import { findPatientByPhone } from "@/lib/db/patients";
import { getPatientVisits } from "@/lib/db/visits";
import { createAppointment } from "@/lib/db/appointments";
import { isValidPhone } from "@/lib/phone";
import { todayLocalStr } from "@/lib/calendar";

// Public, no-auth actions backing app/book/[clinicId] — the patient-facing
// booking page. Every write re-derives its own facts from the database
// rather than trusting anything the client sent beyond the raw form
// fields, the same caution app/api/public/appointments/route.ts uses for
// the marketing site's booking form.

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface RecentVisitSummary {
  sessionType: string;
  date: string;
}

export interface MatchedPatient {
  patientId: string;
  patientName: string;
  recentVisits: RecentVisitSummary[];
}

/**
 * Looks a patient up by phone, then requires the name they typed to match
 * too before revealing anything about their visit history — phone numbers
 * alone are guessable, and this page has no login. A mismatch (or no
 * patient at all) both come back as `{ matched: false }`, deliberately
 * indistinguishable, so this can't be used to probe whether a given phone
 * number belongs to an existing patient.
 */
export async function lookupPatientAction(
  clinicId: string,
  name: string,
  phone: string
): Promise<{ matched: true; patient: MatchedPatient } | { matched: false } | { error: string }> {
  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  if (!trimmedName) return { error: "Enter your name." };
  if (!isValidPhone(trimmedPhone)) return { error: "Enter a valid phone number." };

  try {
    const clinic = await getClinic(clinicId);
    if (!clinic) return { error: "This clinic isn't set up for online booking." };
    if (getClinicAccess(clinic).status === "locked") {
      return { error: "This clinic isn't accepting online bookings right now." };
    }

    const found = await findPatientByPhone(clinicId, trimmedPhone);
    if (!found || normalizeName(found.name) !== normalizeName(trimmedName)) {
      return { matched: false };
    }

    const visits = await getPatientVisits(clinicId, found.id);
    const latestPerType = new Map<string, { sessionType: string; date: string; createdAt: number }>();
    for (const v of visits) {
      const existing = latestPerType.get(v.sessionType);
      if (!existing || v.createdAt > existing.createdAt) {
        latestPerType.set(v.sessionType, { sessionType: v.sessionType, date: v.date, createdAt: v.createdAt });
      }
    }
    const recentVisits = [...latestPerType.values()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 4)
      .map(({ sessionType, date }) => ({ sessionType, date }));

    return { matched: true, patient: { patientId: found.id, patientName: found.name, recentVisits } };
  } catch (err) {
    console.error("Failed to look up patient for public booking:", err);
    return { error: "Something went wrong looking that up. Please try again." };
  }
}

export interface PublicBookingInput {
  name: string;
  phone: string;
  sessionType: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  notes?: string;
}

export async function submitBookingAction(
  clinicId: string,
  input: PublicBookingInput
): Promise<{ ok: true } | { error: string }> {
  const name = input.name.trim();
  const phone = input.phone.trim();
  if (!name) return { error: "Enter your name." };
  if (!isValidPhone(phone)) return { error: "Enter a valid phone number." };
  if (!input.sessionType) return { error: "Choose a treatment." };
  if (!input.date || input.date < todayLocalStr()) return { error: "Choose a date from today onward." };
  if (!input.time) return { error: "Choose a time." };

  try {
    const clinic = await getClinic(clinicId);
    if (!clinic) return { error: "This clinic isn't set up for online booking." };
    if (getClinicAccess(clinic).status === "locked") {
      return { error: "This clinic isn't accepting online bookings right now." };
    }

    // Never trust a caller-supplied sessionType — validate it against this
    // clinic's actual treatment list, since an unrecognized key crashes the
    // staff calendar views (they index straight into SESSION_TYPE_CONFIG
    // with no fallback).
    const customTypes = await getClinicSessionTypeDefs(clinicId);
    const config = buildSessionTypeConfig(customTypes);
    if (!config[input.sessionType]) return { error: "Choose a valid treatment." };

    // Re-derive the patient link server-side, same reasoning as
    // lookupPatientAction — a client-supplied patientId is never trusted.
    const found = await findPatientByPhone(clinicId, phone);
    const patientId = found && normalizeName(found.name) === normalizeName(name) ? found.id : undefined;

    await createAppointment({
      clinicId,
      patientId,
      patientName: name,
      patientPhone: phone,
      sessionType: input.sessionType,
      date: input.date,
      time: input.time,
      durationMinutes: 30,
      status: "booked",
      notes: input.notes?.trim() || undefined,
    });
    return { ok: true };
  } catch (err) {
    console.error("Failed to create public appointment booking:", err);
    return { error: "Something went wrong booking this. Please try again." };
  }
}
