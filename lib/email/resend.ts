import "server-only";
import { Resend } from "resend";

// Lazily initialized, same reasoning as lib/firebase/admin.ts's
// getAdminApp() and lib/razorpay.ts's getClient(): avoids requiring a real
// API key at `next build` time, only when a request actually needs to send.
let _client: Resend | undefined;

function getClient(): Resend {
  if (_client) return _client;

  const apiKey = process.env.RESEND_KEY_ID;
  if (!apiKey) {
    throw new Error("Missing RESEND_KEY_ID in .env.local. See .env.local.example.");
  }

  _client = new Resend(apiKey);
  return _client;
}

/**
 * Sends a transactional email — currently only used for 2FA sign-in codes
 * (lib/twoFactor.ts), but written generically so trial/renewal reminder
 * emails (a known gap — see README) can reuse this later.
 *
 * On Resend's free tier without a verified sending domain, the default
 * `onboarding@resend.dev` sender can only deliver to the email address that
 * owns the Resend account itself — fine for development, but real delivery
 * to clinic staff needs a verified domain configured in the Resend
 * dashboard and RESEND_FROM_EMAIL set to an address on it.
 */
export async function sendEmail(input: { to: string; subject: string; html: string; replyTo?: string }): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL || "RadianceLaser <onboarding@resend.dev>";

  const { error } = await getClient().emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}
