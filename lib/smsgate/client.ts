import "server-only";

/**
 * STUB — not wired up yet. Plain SMS (as opposed to WhatsApp) is meant to go
 * through an Android phone running the SMS Gateway app, fronted by a Google
 * Apps Script web app acting as the HTTP endpoint this server calls — but
 * that Apps Script deployment doesn't exist yet, so this always throws.
 *
 * Once the Apps Script is deployed, set SMS_GATE_WEBHOOK_URL in .env.local
 * to its "/exec" URL and fill in the real request shape below (this guesses
 * a JSON POST with { phone, message } — adjust to match whatever the Apps
 * Script actually expects).
 */
export async function sendSms(phone: string, message: string): Promise<{ raw: string }> {
  const webhookUrl = process.env.SMS_GATE_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error(
      "SMS sending isn't set up yet — add SMS_GATE_WEBHOOK_URL in .env.local once the SMS Gateway " +
        "Apps Script is deployed. See lib/smsgate/client.ts."
    );
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, message }),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`SMS Gate send failed: ${res.status} ${raw}`);
  }
  return { raw };
}
