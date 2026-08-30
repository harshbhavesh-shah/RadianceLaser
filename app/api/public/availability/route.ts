import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { prisma } from "@/lib/db/client";

// Public, read-only: returns which HH:MM times are already taken for a
// given clinic + sessionType + date, so the marketing site's shared
// appointment form can grey out taken slots before submitting a public
// booking. Goes through the Admin SDK rather than a client-side Firestore
// read — firestore.rules has no public read rule for appointments (they
// contain patient names/phone numbers), so this route is the only way an
// anonymous visitor can see availability without exposing patient data.
//
// Checks both stores: appointments booked from inside the app now live in
// Postgres (lib/db/appointments.ts), but this endpoint itself is what the
// marketing site's own booking form calls, and that form writes new public
// bookings straight into Firestore — so a slot taken by either needs to
// show as taken here, or double-booking is trivial to hit by accident.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clinicId = searchParams.get("clinicId");
  const sessionType = searchParams.get("sessionType");
  const date = searchParams.get("date");
  if (!clinicId || !sessionType || !date) {
    return NextResponse.json({ error: "Missing clinicId, sessionType, or date" }, { status: 400, headers: CORS_HEADERS });
  }

  const [firestoreSnap, postgresRows] = await Promise.all([
    adminDb()
      .collection("appointments")
      .where("clinicId", "==", clinicId)
      .where("sessionType", "==", sessionType)
      .where("date", "==", date)
      .get(),
    prisma.appointment.findMany({
      where: { clinicId, sessionType, date },
      select: { time: true, status: true },
    }),
  ]);

  const bookedTimes = [
    ...firestoreSnap.docs.map((doc) => doc.data()).filter((a) => a.status !== "cancelled").map((a) => a.time as string),
    ...postgresRows.filter((a) => a.status !== "cancelled").map((a) => a.time),
  ];

  return NextResponse.json({ bookedTimes }, { headers: CORS_HEADERS });
}
