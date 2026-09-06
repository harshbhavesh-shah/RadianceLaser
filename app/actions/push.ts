"use server";

import { getSession, getAdminSession } from "@/lib/session";
import { upsertPushToken, deletePushToken } from "@/lib/db/pushTokens";

/** Registers the calling device's FCM token against whichever session is
 * currently active — a clinic session if this account runs a clinic, else
 * the platform-admin session for a pure super-admin account (see
 * types/index.ts Session.isSuperAdmin for the dual-purpose-account case).
 * Called from components/native/NativeAppBridge.tsx on every native-app
 * cold start, since re-sending an unchanged token is just a harmless
 * no-op upsert. */
export async function registerPushTokenAction(token: string): Promise<{ error?: string }> {
  const clinicSession = await getSession();
  if (clinicSession) {
    await upsertPushToken(token, clinicSession.uid, clinicSession.clinicId, clinicSession.isSuperAdmin);
    return {};
  }

  const adminSession = await getAdminSession();
  if (adminSession) {
    await upsertPushToken(token, adminSession.uid, null, true);
    return {};
  }

  return { error: "Not authenticated." };
}

/** Called on logout so a shared/reset device stops receiving notifications
 * meant for whoever was signed in before. */
export async function unregisterPushTokenAction(token: string): Promise<void> {
  await deletePushToken(token);
}
