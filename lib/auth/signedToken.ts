// A generic, self-verifying signed token: base64url(payload).base64url(HMAC
// signature). Built on Web Crypto (`crypto.subtle`), not Node's `crypto`
// module, so the exact same code runs in both a Node server action AND
// Edge middleware (which can't load Node's crypto) — that's what lets
// middleware.ts do real signature verification instead of the old
// presence-only cookie check. Deliberately not a JWT library: this app
// only ever needs "sign a small JSON payload, verify it came from us,
// check an `exp`", and a real JWT's header/alg-negotiation surface is
// attack surface this doesn't need.
//
// Used for both the session cookie (lib/session.ts) and the short-lived
// 2FA pre-auth ticket (lib/twoFactor.ts) — anywhere the app needs to hand
// a client a piece of state it can't forge or read secrets out of.

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(str.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signToken(payload: Record<string, unknown>, secret: string): Promise<string> {
  const payloadB64 = base64url(encoder.encode(JSON.stringify(payload)));
  const key = await importKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return `${payloadB64}.${base64url(new Uint8Array(signature))}`;
}

/** Verifies the signature and returns the decoded payload, or null if the
 * token is malformed, tampered with, or signed under a different secret.
 * Does NOT check any `exp` field itself — callers that put one in the
 * payload (both current callers do) check it themselves right after. */
export async function verifyToken<T = Record<string, unknown>>(token: string, secret: string): Promise<T | null> {
  const dot = token.indexOf(".");
  if (dot === -1) return null;
  const payloadB64 = token.slice(0, dot);
  const signatureB64 = token.slice(dot + 1);
  if (!payloadB64 || !signatureB64) return null;

  try {
    const key = await importKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlToBytes(signatureB64) as BufferSource,
      encoder.encode(payloadB64) as BufferSource
    );
    if (!valid) return null;
    return JSON.parse(decoder.decode(base64urlToBytes(payloadB64))) as T;
  } catch {
    return null;
  }
}
