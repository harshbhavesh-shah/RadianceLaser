import "server-only";
import type { WhatsAppConnection } from "@/types";

/**
 * Wraps BhashSMS's WhatsApp send API — a plain GET request, no OAuth or
 * partner account, just a per-clinic username/password/sender id supplied
 * directly on every call. Confirmed request shape (from the clinic's real
 * account):
 *
 *   http://bhashsms.com/api/sendmsg.php?user=USER&pass=PASS&sender=SENDER
 *     &phone=MOBILE&text=TEMPLATENAME&priority=wa&stype=normal
 *     &Params=param1,param2
 *
 * Response format is still only partially confirmed. One real failure case
 * has been observed against the clinic's actual account (wrong password):
 * a 200 OK with a plain-text/HTML-ish body like
 * "<br>Username/Password Incorrect or Account Deactivated" — no JSON, no
 * distinct HTTP status. isErrorResponse() below is written to catch that
 * plus other likely wordings; the real *success* response body still
 * hasn't been seen, so isErrorResponse() may need loosening (or a
 * success-shape check added) once one comes in — a false "sent" is worse
 * than a false failure here, so lean toward flagging unfamiliar responses
 * as errors rather than assuming success.
 */

const SEND_URL = "http://bhashsms.com/api/sendmsg.php";

function isErrorResponse(raw: string): boolean {
  return /error|invalid|fail(ed)?|not\s*found|incorrect|deactivated|denied|unauthoriz|rejected/i.test(raw);
}

/** Sends an approved WhatsApp template message, filling in the template's
 * placeholders in order via the comma-separated Params param. `templateName`
 * must exactly match the name approved on BhashSMS/Meta's side. */
export async function sendTemplateMessage(
  connection: Pick<WhatsAppConnection, "bhashUser" | "bhashPass" | "senderId">,
  toPhone: string,
  templateName: string,
  params: string[]
): Promise<{ raw: string }> {
  if (!connection.bhashPass) {
    throw new Error("This clinic's WhatsApp connection is missing its BhashSMS password.");
  }

  const url = new URL(SEND_URL);
  url.searchParams.set("user", connection.bhashUser);
  url.searchParams.set("pass", connection.bhashPass);
  url.searchParams.set("sender", connection.senderId);
  url.searchParams.set("phone", toPhone);
  url.searchParams.set("text", templateName);
  url.searchParams.set("priority", "wa");
  url.searchParams.set("stype", "normal");
  if (params.length > 0) url.searchParams.set("Params", params.join(","));

  const res = await fetch(url.toString());
  const raw = await res.text();
  if (!res.ok || isErrorResponse(raw)) {
    throw new Error(`BhashSMS send failed: ${res.status} ${raw}`);
  }
  return { raw };
}
