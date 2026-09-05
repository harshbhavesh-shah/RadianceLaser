import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getWhatsAppConnection } from "@/lib/db/whatsapp";
import { getClinicMessageTemplates } from "@/lib/db/messageTemplates";
import { getClinic } from "@/lib/db/clinics";
import { getClinicVisitFeedback } from "@/lib/db/visitFeedback";
import ClientLinksSection from "@/components/communication/ClientLinksSection";
import WhatsAppSection from "@/components/communication/WhatsAppSection";
import WebhookInfoSection from "@/components/communication/WebhookInfoSection";
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
  // Never forward accessToken/appSecret to the client — WhatsAppSection
  // only needs to know whether/how a connection exists, not the secrets
  // themselves.
  const redactedConnection = whatsappConnection
    ? { ...whatsappConnection, accessToken: undefined, appSecret: undefined }
    : null;

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl font-medium text-brown-900">Communication</h1>
      <div className="mt-2 mb-8 h-[2px] w-8 bg-gold-500" />

      {/* Main column carries the two things worth reading at length —
          templates and patient feedback. The connection form and the
          automation toggles are both short, settings-shaped controls, so
          they sit in a narrower sidebar instead of stretching to match the
          main column's width for no reason. */}
      {/* minmax(0,1fr), not a bare 1fr — a bare 1fr's implicit minimum is
          "auto" (its content's own width), so a long unbroken string
          anywhere in the left column (a template name, an API response) can
          force this track past its fair share and push the fixed 380px
          column off the edge of the page entirely, with no scrollbar to
          reach it since <main> deliberately never scrolls horizontally. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="min-w-0 space-y-6">
          <MessageTemplatesSection
            initialTemplates={messageTemplates}
            isConnected={isConnected}
            canEdit={isOwner}
          />
          <FeedbackResultsSection feedback={visitFeedback} />
        </div>

        <div className="min-w-0 space-y-6">
          <ClientLinksSection clinicId={session.clinicId} />

          <WhatsAppSection initialConnection={redactedConnection} canEdit={isOwner} />

          <WebhookInfoSection verifyToken={process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || null} />

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
