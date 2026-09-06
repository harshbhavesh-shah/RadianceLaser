import "server-only";
import { adminMessaging } from "@/lib/firebase/admin";
import { getPushTokensForClinic, deletePushToken } from "@/lib/db/pushTokens";

interface PushPayload {
  title: string;
  body: string;
  /** Arbitrary string data delivered alongside the notification — e.g. a
   * path to open when the notification is tapped. FCM requires every data
   * value to be a string. */
  data?: Record<string, string>;
}

/** Sends a push to every device currently signed in to this clinic. Silent
 * no-op if the clinic has no registered devices (e.g. no one's installed
 * the Android app yet) — this is best-effort delivery, never something a
 * caller should have to handle failure for. */
export async function sendPushToClinic(clinicId: string, payload: PushPayload): Promise<void> {
  const tokens = await getPushTokensForClinic(clinicId);
  if (tokens.length === 0) return;

  const response = await adminMessaging().sendEachForMulticast({
    tokens,
    notification: { title: payload.title, body: payload.body },
    data: payload.data,
    android: { priority: "high" },
  });

  // A token stops being valid the moment the app is uninstalled or its
  // local FCM registration is invalidated — Firebase reports that per-token
  // rather than failing the whole batch, so this is the only place stale
  // rows ever get cleaned up.
  await Promise.all(
    response.responses.map((result, i) => {
      const code = result.error?.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
        return deletePushToken(tokens[i]);
      }
      return Promise.resolve();
    })
  );
}
