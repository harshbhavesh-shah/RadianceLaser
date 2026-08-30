import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getWhatsAppConnection } from "@/lib/firestore/whatsapp";
import { getClinicMessageTemplates } from "@/lib/db/messageTemplates";
import WhatsAppSection from "@/components/communication/WhatsAppSection";
import MessageTemplatesSection from "@/components/communication/MessageTemplatesSection";

export default async function CommunicationPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [whatsappConnection, messageTemplates] = await Promise.all([
    getWhatsAppConnection(session.clinicId),
    getClinicMessageTemplates(session.clinicId),
  ]);

  const isOwner = session.role === "owner";
  // Never forward bhashPass to the client — WhatsAppSection only needs to
  // know whether/how a connection exists, not the secret itself.
  const redactedConnection = whatsappConnection ? { ...whatsappConnection, bhashPass: undefined } : null;

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-medium text-brown-900">Communication</h1>
      <div className="mt-2 mb-8 h-[2px] w-8 bg-gold-500" />

      <div className="space-y-6">
        <WhatsAppSection initialConnection={redactedConnection} canEdit={isOwner} />

        <MessageTemplatesSection
          initialTemplates={messageTemplates}
          isConnected={whatsappConnection?.status === "connected"}
          canEdit={isOwner}
        />
      </div>
    </div>
  );
}
