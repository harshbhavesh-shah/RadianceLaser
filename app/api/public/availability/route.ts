import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

// Public, read-only: returns which HH:MM times are already taken for a
// given clinic + sessionType + date, so the marketing site's shared
// appointment form can grey out taken slots before submitting a public
// booking (see app/api/public/appointments/route.ts). Used to also merge
// in a separate Firestore read — that went away once public bookings
// started landing directly in Postgres (see prisma/schema.prisma's
// Appointment model comment) — this is a plain single-store query now.
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

  const rows = await prisma.appointment.findMany({
    where: { clinicId, sessionType, date },
    select: { time: true, status: true },
  });

  const bookedTimes = rows.filter((a) => a.status !== "cancelled").map((a) => a.time);

  return NextResponse.json({ bookedTimes }, { headers: CORS_HEADERS });
}
