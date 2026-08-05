import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import type { MessageTemplate, WhatsAppConnection } from "@/types";

export async function getWhatsAppConnection(clinicId: string): Promise<WhatsAppConnection | null> {
  const doc = await adminDb().collection("whatsappConnections").doc(clinicId).get();
  return doc.exists ? ({ id: doc.id, ...doc.data() } as WhatsAppConnection) : null;
}

export async function getClinicMessageTemplates(clinicId: string): Promise<MessageTemplate[]> {
  const snap = await adminDb().collection("messageTemplates").where("clinicId", "==", clinicId).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as MessageTemplate)
    .sort((a, b) => b.createdAt - a.createdAt);
}
