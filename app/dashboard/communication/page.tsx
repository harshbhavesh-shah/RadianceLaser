import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getWhatsAppConnection } from "@/lib/db/whatsapp";
import { getClinicMessageTemplates } from "@/lib/db/messageTemplates";
import { getClinic } from "@/lib/db/clinics";
import { getClinicVisitFeedback } from "@/lib/db/visitFeedback";
import { getClinicConversations } from "@/lib/db/whatsappConversations";
import { getClinicTier, getEntitlements } from "@/lib/entitlements";
import CommunicationTabs from "@/components/communication/CommunicationTabs";

export default async function CommunicationPage({
  searchParams,
}: {
  // Set by a push notification tap on an inbound WhatsApp message (see
  // app/api/webhooks/whatsapp/route.ts) to land directly on the Inbox tab.
  searchParams: { tab?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/api/auth/force-logout");

  const [whatsappConnection, messageTemplates, clinic, visitFeedback, conversations] = await Promise.all([
    getWhatsAppConnection(session.clinicId),
    getClinicMessageTemplates(session.clinicId),
    getClinic(session.clinicId),
    getClinicVisitFeedback(session.clinicId),
    getClinicConversations(session.clinicId),
  ]);

  const isOwner = session.role === "owner";
  const isConnected = whatsappConnection?.status === "connected";
  // Never forward accessToken/appSecret to the client — WhatsAppSection
  // only needs to know whether/how a connection exists, not the secrets
  // themselves.
  const redactedConnection = whatsappConnection
    ? { ...whatsappConnection, accessToken: undefined, appSecret: undefined }
    : null;

  const tier = getClinicTier(
    clinic ?? { subscriptionStatus: "active", trialEndsAt: 0, planTier: null }
  );
  const inboxEntitled = getEntitlements(tier).whatsappAutomation;

  return (
    <div className="max-w-6xl">
      <h1 className="mb-8 inline-block border-b-4 border-rust-600 pb-1 font-display text-2xl font-bold text-brown-900">
        Communication
      </h1>

      <CommunicationTabs
        clinicId={session.clinicId}
        clinicSlug={clinic?.slug ?? ""}
        isOwner={isOwner}
        messageTemplates={messageTemplates}
        isConnected={isConnected}
        visitFeedback={visitFeedback}
        redactedConnection={redactedConnection}
        scheduledMessagesInitial={{
          reminderEnabled: clinic?.reminderEnabled ?? false,
          reminderHoursBefore: clinic?.reminderHoursBefore ?? 24,
          feedbackSurveyEnabled: clinic?.feedbackSurveyEnabled ?? false,
          feedbackSurveyDelayHours: clinic?.feedbackSurveyDelayHours ?? 3,
        }}
        webhookVerifyToken={process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || null}
        conversations={conversations}
        inboxEntitled={inboxEntitled}
        initialTab={searchParams.tab === "inbox" ? "inbox" : undefined}
      />
    </div>
  );
}
