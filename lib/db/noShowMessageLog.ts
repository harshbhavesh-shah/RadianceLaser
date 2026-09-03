import "server-only";
import { prisma } from "@/lib/db/client";

// Send history for (appointment, follow-up) pairs. Read-only from the
// no-show list page; written only by the cron.

export async function hasNoShowMessageBeenSent(appointmentId: string, followUpId: string): Promise<boolean> {
  const row = await prisma.noShowMessageLog.findUnique({
    where: { appointmentId_followUpId: { appointmentId, followUpId } },
    select: { id: true },
  });
  return row !== null;
}

export async function logNoShowMessageSent(clinicId: string, appointmentId: string, followUpId: string): Promise<void> {
  await prisma.noShowMessageLog.create({
    data: { clinicId, appointmentId, followUpId, sentAt: BigInt(Date.now()) },
  });
}

export interface NoShowLogEntry {
  appointmentId: string;
  followUpId: string;
  sentAt: number;
}

/** Every send logged for a clinic, grouped by appointmentId client-side
 * to show "already contacted via X, Y" badges. */
export async function getClinicNoShowMessageLog(clinicId: string): Promise<NoShowLogEntry[]> {
  const rows = await prisma.noShowMessageLog.findMany({
    where: { clinicId },
    select: { appointmentId: true, followUpId: true, sentAt: true },
  });
  return rows.map((r) => ({ appointmentId: r.appointmentId, followUpId: r.followUpId, sentAt: Number(r.sentAt) }));
}
