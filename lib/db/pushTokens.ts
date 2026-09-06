import "server-only";
import { prisma } from "@/lib/db/client";

/** Registers (or re-registers) one device's FCM token — called from
 * app/api/push/register whenever the app has a fresh token, including on
 * every cold start, since Android can rotate a token at any time and the
 * only reliable way to notice is to just re-send it. */
export async function upsertPushToken(
  token: string,
  uid: string,
  clinicId: string | null,
  isSuperAdmin: boolean
): Promise<void> {
  const now = BigInt(Date.now());
  await prisma.pushToken.upsert({
    where: { token },
    create: { token, uid, clinicId, isSuperAdmin, createdAt: now, updatedAt: now },
    update: { uid, clinicId, isSuperAdmin, updatedAt: now },
  });
}

export async function deletePushToken(token: string): Promise<void> {
  await prisma.pushToken.delete({ where: { token } }).catch(() => {});
}

export async function getPushTokensForClinic(clinicId: string): Promise<string[]> {
  const rows = await prisma.pushToken.findMany({
    where: { clinicId },
    select: { token: true },
  });
  return rows.map((r) => r.token);
}
