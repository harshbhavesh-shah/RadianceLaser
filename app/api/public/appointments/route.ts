import { NextResponse } from "next/server";
import { getClinic } from "@/lib/db/clinics";
import { getClinicAccess } from "@/lib/subscription";
import { createAppointment } from "@/lib/db/appointments";

// Public, write-only: lets the marketing site's shared "lhr" appointment
// form (advancedskinclinic-new's appointment.njk) book an appointment
// directly, from an anonymous browser, with no session/auth of any kind.
//
// This replaces a client-side Firestore write the marketing site used to
// make directly against firestore.rules' isValidPublicLhrBooking — see
// prisma/schema.prisma's Appointment model comment for why that could
// finally go away (Appointment.patientId became a real optional column
// instead of a Firestore-only sentinel). The validation below is
// deliberately as close to that Firestore rule's shape as possible: fixed
// sessionType/status, no patientId (an anonymous booker isn't linked to
// any existing Patient — see UnlinkedBookingPanel for how staff link one
// later), and the same required fields. Still gated on the target clinic
// being active/trialing, same as that rule enforced.
//
// advancedskinclinic-new's booking form needs to change to POST here
// instead of writing to Firestore directly — see the repo's README (or
// ask) for the exact payload shape below.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers: CORS_HEADERS });
  }

  const { clinicId, patientName, patientPhone, date, time, durationMinutes, notes } = body as Record<string, unknown>;

  if (typeof clinicId !== "string" || !clinicId) {
    return NextResponse.json({ error: "Missing clinicId" }, { status: 400, headers: CORS_HEADERS });
  }
  if (typeof patientName !== "string" || !patientName.trim()) {
    return NextResponse.json({ error: "Missing patientName" }, { status: 400, headers: CORS_HEADERS });
  }
  if (typeof patientPhone !== "string" || !patientPhone.trim()) {
    return NextResponse.json({ error: "Missing patientPhone" }, { status: 400, headers: CORS_HEADERS });
  }
  if (typeof date !== "string" || !date) {
    return NextResponse.json({ error: "Missing date" }, { status: 400, headers: CORS_HEADERS });
  }
  if (typeof time !== "string" || !time) {
    return NextResponse.json({ error: "Missing time" }, { status: 400, headers: CORS_HEADERS });
  }
  if (typeof durationMinutes !== "number" || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return NextResponse.json({ error: "Missing or invalid durationMinutes" }, { status: 400, headers: CORS_HEADERS });
  }
  if (notes !== undefined && typeof notes !== "string") {
    return NextResponse.json({ error: "Invalid notes" }, { status: 400, headers: CORS_HEADERS });
  }

  const clinic = await getClinic(clinicId);
  if (!clinic) {
    return NextResponse.json({ error: "Clinic not found" }, { status: 404, headers: CORS_HEADERS });
  }
  if (getClinicAccess(clinic).status === "locked") {
    return NextResponse.json({ error: "This clinic isn't accepting bookings right now" }, { status: 403, headers: CORS_HEADERS });
  }

  try {
    // sessionType/status are fixed, not caller-supplied — same as the
    // Firestore rule this replaces required data.sessionType == "lhr" and
    // data.status == "booked" outright rather than trusting the client.
    const id = await createAppointment({
      clinicId,
      patientName: patientName.trim(),
      patientPhone: patientPhone.trim(),
      sessionType: "lhr",
      date,
      time,
      durationMinutes,
      status: "booked",
      notes: notes?.trim() || undefined,
    });
    return NextResponse.json({ id }, { status: 201, headers: CORS_HEADERS });
  } catch (err) {
    console.error("Failed to create public appointment booking:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500, headers: CORS_HEADERS });
  }
}
