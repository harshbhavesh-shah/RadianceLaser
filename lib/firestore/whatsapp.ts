import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { MessageTemplate, WhatsAppConnection } from "@/types";

/** Fails soft (logs and returns null) rather than letting a Firestore-side
 * problem — a quota limit, an outage — take down every page that reads
 * this, the same reasoning as lib/db/appointments.ts
 * getUnlinkedPublicBookings. A null here reads as "not connected" to every
 * caller (the Communication page, and the send actions in
 * app/dashboard/communication/actions.ts, which already handle "not
 * connected" as a normal, expected case) — not perfectly precise about
 * *why*, but never a page crash over it. */
export async function getWhatsAppConnection(clinicId: string): Promise<WhatsAppConnection | null> {
  try {
    const doc = await adminDb().collection("whatsappConnections").doc(clinicId).get();
    return doc.exists ? ({ id: doc.id, ...doc.data() } as WhatsAppConnection) : null;
  } catch (err) {
    console.error(`Failed to fetch WhatsApp connection for clinic ${clinicId}:`, err);
    return null;
  }
}

export async function getClinicMessageTemplates(clinicId: string): Promise<MessageTemplate[]> {
  const snap = await adminDb().collection("messageTemplates").where("clinicId", "==", clinicId).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as MessageTemplate)
    .sort((a, b) => b.createdAt - a.createdAt);
}
