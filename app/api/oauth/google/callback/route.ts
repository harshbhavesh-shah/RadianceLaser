import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/session";
import { exchangeCodeForTokens } from "@/lib/gmail/oauth";
import { fetchAuthorizedAccountEmail } from "@/lib/gmail/client";
import { saveEmailConnection } from "@/lib/db/emailConnection";

const STATE_COOKIE = "google_oauth_state";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  const errorRedirect = (message: string) => {
    const url = new URL("/admin/email", request.url);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url);
  };

  if (params.get("error")) {
    return errorRedirect(`Google sign-in was cancelled or denied (${params.get("error")}).`);
  }
  if (!code) return errorRedirect("No authorization code came back from Google.");
  if (!state || !expectedState || state !== expectedState) {
    return errorRedirect("This sign-in link expired or was tampered with. Please try connecting again.");
  }

  try {
    const redirectUri = new URL("/api/oauth/google/callback", request.url).toString();
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    if (!tokens.refresh_token) {
      // Happens if this Google account already granted consent once before
      // and Google didn't re-issue a refresh_token this time — prompt=
      // consent on the start route is meant to prevent exactly this, but
      // fail loudly rather than silently saving a connection with no way
      // to refresh its access token once it expires.
      return errorRedirect(
        "Google didn't return a refresh token. Try disconnecting this app's access in your Google Account's " +
          "security settings, then connect again."
      );
    }

    const gmailAccount = await fetchAuthorizedAccountEmail(tokens.access_token);
    await saveEmailConnection({ gmailAccount, refreshToken: tokens.refresh_token });

    const response = NextResponse.redirect(new URL("/admin/email", request.url));
    response.cookies.delete(STATE_COOKIE);
    return response;
  } catch (err) {
    console.error("Failed to complete Gmail OAuth connection:", err);
    return errorRedirect("Something went wrong connecting Gmail. Please try again.");
  }
}
