import "server-only";

// Verifies a Google identity without Firebase Auth — plain fetch calls to
// Google's own endpoints, matching this codebase's existing OAuth style
// (see lib/gmail/oauth.ts) rather than pulling in a JWT/JWKS library. The
// tokeninfo endpoint does the signature/expiry verification server-side on
// Google's end and just hands back the verified claims, which is all a
// single one-off sign-in check needs.
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  name: string | null;
}

interface TokenInfoResponse {
  aud?: string;
  email?: string;
  email_verified?: string;
  name?: string;
}

async function verifyIdTokenAudience(idToken: string): Promise<GoogleIdentity | null> {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const res = await fetch(`${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) return null;

  const info = (await res.json()) as TokenInfoResponse;
  // aud must be OUR client id specifically — otherwise this is a valid
  // Google ID token for a completely different application, and accepting
  // it here would let that application's sign-in vouch for our own.
  if (info.aud !== clientId || !info.email) return null;

  return { email: info.email, emailVerified: info.email_verified === "true", name: info.name || null };
}

/**
 * Web sign-in path: Google Identity Services' `initCodeClient` popup flow
 * (see lib/authFlow.ts) hands the client a one-time authorization code, not
 * an ID token directly — this exchanges it server-side (needs the client
 * secret) for tokens, then verifies the resulting ID token the same way the
 * native path does. "postmessage" is GIS's own fixed placeholder for
 * `redirect_uri` in popup mode, not a real URL — required by Google's token
 * endpoint for this flow, nothing to configure for it in Cloud Console.
 */
export async function verifyGoogleSignInCode(code: string): Promise<GoogleIdentity | null> {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: "postmessage",
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    console.error("Google sign-in token exchange failed:", await tokenRes.text());
    return null;
  }

  const tokens = (await tokenRes.json()) as { id_token?: string };
  if (!tokens.id_token) return null;
  return verifyIdTokenAudience(tokens.id_token);
}

/**
 * Native sign-in path: the Android app's own account picker (via a
 * Capacitor Google Sign-In plugin, not a WebView popup — Google blocks
 * OAuth popups inside embedded WebViews, which is exactly why this app has
 * a separate native path at all — see lib/authFlow.ts) hands back a Google
 * ID token directly, no code exchange needed.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity | null> {
  return verifyIdTokenAudience(idToken);
}
