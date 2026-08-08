import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

// Public, read-only: returns which HH:MM times are already taken for a
// given clinic + sessionType + date, so the marketing site's shared
// appointment form can grey out taken slots before submitting a public
// booking. Goes through the Admin SDK rather than a client-side Firestore
// read — firestore.rules has no public read rule for appointments (they
// contain patient names/phone numbers), so this route is the only way an
// anonymous visitor can see availability without exposing patient data.
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

  const snap = await adminDb()
    .collection("appointments")
    .where("clinicId", "==", clinicId)
    .where("sessionType", "==", sessionType)
    .where("date", "==", date)
    .get();

  const bookedTimes = snap.docs
    .map((doc) => doc.data())
    .filter((a) => a.status !== "cancelled")
    .map((a) => a.time as string);

  return NextResponse.json({ bookedTimes }, { headers: CORS_HEADERS });
}
