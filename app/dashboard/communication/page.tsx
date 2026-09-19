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
  // Never forward accessToken/appSecret to the client — WhatsAppSetupBanner
  // and its connect modal only need to know whether/how a connection
  // exists, not the secrets themselves.
  const redactedConnection = whatsappConnection
    ? { ...whatsappConnection, accessToken: undefined, appSecret: undefined }
    : null;

  const tier = getClinicTier(
    clinic ?? { subscriptionStatus: "active", trialEndsAt: 0, planTier: null }
  );
  const inboxEntitled = getEntitlements(tier).whatsappAutomation;

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="m-0 text-[34px] font-extrabold tracking-tight text-brown-900">Communication</h1>
        <div className="h-1 w-16 rounded-full bg-rust-600" />
      </div>

      <CommunicationTabs
        clinicId={session.clinicId}
        clinicSlug={clinic?.slug ?? ""}
        isOwner={isOwner}
        messageTemplates={messageTemplates}
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
