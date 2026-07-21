import { NextResponse } from "next/server";
import { createSessionCookie } from "@/lib/session";

// The client signs in with Firebase Auth directly (email/password), gets an
// ID token, then POSTs it here. We verify it and exchange it for a secure
// HttpOnly cookie — the ID token itself never touches a cookie, since it's
// short-lived and meant for direct API calls, not session storage.
export async function POST(request: Request) {
  try {
    const { idToken } = await request.json();

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    await createSessionCookie(idToken);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to create session:", err);
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }
}
