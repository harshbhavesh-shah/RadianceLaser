"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import ClientLinksSection from "./ClientLinksSection";
import WhatsAppSetupBanner from "./WhatsAppSetupBanner";
import MessageTemplatesSection from "./MessageTemplatesSection";
import ScheduledMessagesSection from "./ScheduledMessagesSection";
import FeedbackResultsSection from "./FeedbackResultsSection";
import InboxClient from "@/components/inbox/InboxClient";
import type {
  Clinic,
  MessageTemplate,
  VisitFeedback,
  WhatsAppConnection,
  WhatsAppConversation,
} from "@/types";

type Tab = "whatsapp" | "inbox";

/** WhatsApp settings and the two-way Inbox used to be separate sidebar
 * pages — merged into one page with tabs (see the Patients page's own
 * tab bar for the pattern this follows) since they're really one feature
 * (WhatsApp messaging) split across configuration and the conversations
 * that configuration enables. Inbox's own tier gate (whatsappAutomation)
 * now disables just that tab instead of redirecting the whole page away. */
export default function CommunicationTabs({
  clinicId,
  clinicSlug,
  isOwner,
  messageTemplates,
  visitFeedback,
  redactedConnection,
  scheduledMessagesInitial,
  webhookVerifyToken,
  conversations,
  inboxEntitled,
  initialTab,
}: {
  clinicId: string;
  clinicSlug: string;
  isOwner: boolean;
  messageTemplates: MessageTemplate[];
  visitFeedback: VisitFeedback[];
  redactedConnection: WhatsAppConnection | null;
  scheduledMessagesInitial: Pick<
    Clinic,
    "reminderEnabled" | "reminderHoursBefore" | "feedbackSurveyEnabled" | "feedbackSurveyDelayHours"
  >;
  webhookVerifyToken: string | null;
  conversations: WhatsAppConversation[];
  inboxEntitled: boolean;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab || "whatsapp");
  const [connection, setConnection] = useState(redactedConnection);
  const connected = connection?.status === "connected";

  const TABS: { key: Tab; label: string }[] = [
    { key: "whatsapp", label: "WhatsApp" },
    { key: "inbox", label: "Inbox" },
  ];

  return (
    <div>
      <div className="mb-6 inline-flex w-fit gap-1 rounded-xl bg-surface p-1 shadow-soft">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[9px] px-[22px] py-2.5 text-sm font-bold transition-colors ${
              tab === t.key ? "bg-beige-200 text-rust-700" : "text-brown-400 hover:text-brown-900"
            }`}
          >
            {t.label}
            {t.key === "inbox" && !inboxEntitled && <Lock size={12} className="opacity-70" />}
          </button>
        ))}
      </div>

      {tab === "whatsapp" && (
        <div className="flex flex-col gap-5">
          <WhatsAppSetupBanner
            connection={connection}
            verifyToken={webhookVerifyToken}
            canEdit={isOwner}
            onConnectionChange={setConnection}
          />

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <div className="flex min-w-0 flex-[1.6] flex-col gap-5">
              <MessageTemplatesSection initialTemplates={messageTemplates} isConnected={connected} canEdit={isOwner} />
              <FeedbackResultsSection feedback={visitFeedback} />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <ClientLinksSection clinicId={clinicId} clinicSlug={clinicSlug} />

              <ScheduledMessagesSection
                initialClinic={scheduledMessagesInitial}
                templates={messageTemplates}
                isConnected={connected}
                canEdit={isOwner}
              />
            </div>
          </div>
        </div>
      )}

      {tab === "inbox" &&
        (inboxEntitled ? (
          <InboxClient initialConversations={conversations} />
        ) : (
          <div className="rounded-2xl border border-beige-300 bg-surface p-10 text-center shadow-soft">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rust-100">
              <Lock className="text-rust-700" size={20} />
            </div>
            <p className="mt-3 text-sm font-medium text-brown-700">Inbox needs the Pro plan.</p>
            <p className="mt-1 text-sm text-brown-400">
              Two-way WhatsApp conversations are available on Pro. Upgrade in Settings to turn this on.
            </p>
          </div>
        ))}
    </div>
  );
}
