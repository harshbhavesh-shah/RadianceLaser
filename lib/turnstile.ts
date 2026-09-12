import "server-only";

// Cloudflare Turnstile verification for /signup (app/signup/actions.ts) —
// closes the gap the rate limit alone couldn't (lib/db/signupAttempts.ts):
// a bot rotating across many IPs never trips a per-IP counter, but still
// has to solve (or fail) the same challenge every real browser gets.
//
// Not configured yet is treated as "skip the check", same pattern as
// RAZORPAY_KEY_ID elsewhere — signup keeps working with just the rate
// limit until TURNSTILE_SECRET_KEY is set, rather than breaking local dev
// or a fresh deploy that hasn't set up Turnstile yet.
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("Turnstile verification request failed:", err);
    return false;
  }
}
