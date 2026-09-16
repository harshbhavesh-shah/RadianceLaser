"use server";

import { getClinic } from "@/lib/db/clinics";
import { getClinicAccess } from "@/lib/subscription";
import { findPatientByPhone } from "@/lib/db/patients";
import { createAppointment } from "@/lib/db/appointments";
import { getPatientVisits } from "@/lib/db/visits";
import { getClinicSessionTypeDefs } from "@/lib/db/sessionTypeDefs";
import { buildSessionTypeConfig } from "@/lib/sessionTypes";
import { isValidPhone } from "@/lib/phone";
import { todayLocalStr } from "@/lib/calendar";

// Public, no-auth actions backing app/book/[slug] — the patient-facing
// booking page. Every write re-derives its own facts from the database
// rather than trusting anything the client sent beyond the raw form
// fields, the same caution app/api/public/appointments/route.ts uses for
// the marketing site's booking form.
//
// This page only ever books a "consultation" (see BUILT_IN_SESSION_TYPE_
// CONFIG in lib/sessionTypes.ts) — a visitor booking online, new or
// returning, doesn't know which specific treatment they need yet, so
// there's deliberately no treatment picker here for either, "Book Again"
// on a past treatment included (see recentTreatments below) — it's shown
// for recognition/reassurance only, every path here still books the same
// consultation. That's decided in person, by the doctor.

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface RecentTreatment {
  label: string; // e.g. "Laser Hair Removal" — resolved through the clinic's own session type config, not a raw key
  lastDate: string; // YYYY-MM-DD
}

export interface MatchedPatient {
  patientId: string;
  patientName: string;
  // Up to 2 of the patient's most recently distinct treatment types, most
  // recent first — purely for the "welcome back" screen's recognition
  // (design/DashboardOverviewDesign's renderStep2A "Book Again" cards).
  // Empty if they have no visit history yet (e.g. only ever booked online
  // before, never actually seen).
  recentTreatments: RecentTreatment[];
}

/**
 * Looks a patient up by phone, then requires the name they typed to match
 * too before confirming a match — phone numbers alone are guessable, and
 * this page has no login. A mismatch (or no patient at all) both come back
 * as `{ matched: false }`, deliberately indistinguishable, so this can't be
 * used to probe whether a given phone number belongs to an existing
 * patient. Also surfaces up to 2 recent treatment types (see
 * RecentTreatment) purely for the "welcome back" screen's recognition —
 * nothing here lets the visitor actually pick or re-book a specific past
 * treatment, "Book Again" and "book something else" both end up booking
 * the same consultation.
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

    const [visits, sessionTypeDefs] = await Promise.all([
      getPatientVisits(clinicId, found.id),
      getClinicSessionTypeDefs(clinicId),
    ]);
    const sessionTypeConfig = buildSessionTypeConfig(sessionTypeDefs);

    // Most recent visit per distinct treatment type, newest overall first
    // — visits within a date are otherwise in whatever order the query
    // returned them, which is fine, this only needs "most recent by day."
    const mostRecentByType = new Map<string, string>();
    for (const v of visits) {
      if (!v.date) continue;
      const existing = mostRecentByType.get(v.sessionType);
      if (!existing || v.date > existing) mostRecentByType.set(v.sessionType, v.date);
    }
    const recentTreatments: RecentTreatment[] = [...mostRecentByType.entries()]
      .sort((a, b) => (a[1] < b[1] ? 1 : -1))
      .slice(0, 2)
      .map(([sessionType, lastDate]) => ({
        label: sessionTypeConfig[sessionType]?.label ?? sessionType,
        lastDate,
      }));

    return {
      matched: true,
      patient: { patientId: found.id, patientName: found.name, recentTreatments },
    };
  } catch (err) {
    console.error("Failed to look up patient for public booking:", err);
    return { error: "Something went wrong looking that up. Please try again." };
  }
}

export interface PublicBookingInput {
  name: string;
  phone: string;
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
  if (!input.date || input.date < todayLocalStr()) return { error: "Choose a date from today onward." };
  if (!input.time) return { error: "Choose a time." };

  try {
    const clinic = await getClinic(clinicId);
    if (!clinic) return { error: "This clinic isn't set up for online booking." };
    if (getClinicAccess(clinic).status === "locked") {
      return { error: "This clinic isn't accepting online bookings right now." };
    }

    // Re-derive the patient link server-side, same reasoning as
    // lookupPatientAction — a client-supplied patientId is never trusted.
    const found = await findPatientByPhone(clinicId, phone);
    const patientId = found && normalizeName(found.name) === normalizeName(name) ? found.id : undefined;

    // sessionType is fixed, not caller-supplied — this page never lets a
    // visitor pick a treatment, so there's nothing to validate here.
    await createAppointment({
      clinicId,
      patientId,
      patientName: name,
      patientPhone: phone,
      sessionType: "consultation",
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
