import "server-only";

// The Gmail OAuth2 dance — see the Google Cloud Console setup this needs
// (OAuth client id/secret, Gmail API enabled) in app/admin/email's README
// note. gmail.modify covers read, send, and marking messages read/unread —
// everything this inbox needs — without the far broader (and unnecessary)
// full-account gmail scope.
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.modify";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set — Gmail isn't configured yet.`);
  return value;
}

export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline", // required to get a refresh_token back
    prompt: "consent", // forces a refresh_token even on a re-connect (Google only issues one on first consent otherwise)
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status}): ${raw}`);
  return JSON.parse(raw);
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(
      `Failed to refresh Google access token (${res.status}): ${raw} — the Gmail connection may need to be redone.`
    );
  }
  const parsed = JSON.parse(raw) as TokenResponse;
  // A 60s safety margin so a token that's about to expire isn't treated as
  // still valid for a call that's about to be made with it.
  return { accessToken: parsed.access_token, expiresAt: Date.now() + (parsed.expires_in - 60) * 1000 };
}
