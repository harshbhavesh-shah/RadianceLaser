import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getWhatsAppConnection } from "@/lib/db/whatsapp";
import { getClinicMessageTemplates } from "@/lib/db/messageTemplates";
import { getClinic } from "@/lib/db/clinics";
import { getClinicVisitFeedback } from "@/lib/db/visitFeedback";
import ClientLinksSection from "@/components/communication/ClientLinksSection";
import WhatsAppSection from "@/components/communication/WhatsAppSection";
import MessageTemplatesSection from "@/components/communication/MessageTemplatesSection";
import ScheduledMessagesSection from "@/components/communication/ScheduledMessagesSection";
import FeedbackResultsSection from "@/components/communication/FeedbackResultsSection";

export default async function CommunicationPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [whatsappConnection, messageTemplates, clinic, visitFeedback] = await Promise.all([
    getWhatsAppConnection(session.clinicId),
    getClinicMessageTemplates(session.clinicId),
    getClinic(session.clinicId),
    getClinicVisitFeedback(session.clinicId),
  ]);

  const isOwner = session.role === "owner";
  const isConnected = whatsappConnection?.status === "connected";
  // Never forward bhashPass to the client — WhatsAppSection only needs to
  // know whether/how a connection exists, not the secret itself.
  const redactedConnection = whatsappConnection ? { ...whatsappConnection, bhashPass: undefined } : null;

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl font-medium text-brown-900">Communication</h1>
      <div className="mt-2 mb-8 h-[2px] w-8 bg-gold-500" />

      {/* Main column carries the two things worth reading at length —
          templates and patient feedback. The connection form and the
          automation toggles are both short, settings-shaped controls, so
          they sit in a narrower sidebar instead of stretching to match the
          main column's width for no reason. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="space-y-6">
          <MessageTemplatesSection
            initialTemplates={messageTemplates}
            isConnected={isConnected}
            canEdit={isOwner}
          />
          <FeedbackResultsSection feedback={visitFeedback} />
        </div>

        <div className="space-y-6">
          <ClientLinksSection clinicId={session.clinicId} />

          <WhatsAppSection initialConnection={redactedConnection} canEdit={isOwner} />

          <ScheduledMessagesSection
            initialClinic={{
              reminderEnabled: clinic?.reminderEnabled ?? false,
              reminderHoursBefore: clinic?.reminderHoursBefore ?? 24,
              feedbackSurveyEnabled: clinic?.feedbackSurveyEnabled ?? false,
              feedbackSurveyDelayHours: clinic?.feedbackSurveyDelayHours ?? 3,
            }}
            templates={messageTemplates}
            isConnected={isConnected}
            canEdit={isOwner}
          />
        </div>
      </div>
    </div>
  );
}
