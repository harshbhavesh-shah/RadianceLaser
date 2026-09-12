import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getClinicConversations } from "@/lib/db/whatsappConversations";
import { getClinic } from "@/lib/db/clinics";
import { getClinicTier, getEntitlements } from "@/lib/entitlements";
import InboxClient from "@/components/inbox/InboxClient";

export default async function InboxPage() {
  const session = await getSession();
  if (!session) redirect("/api/auth/force-logout");

  const clinic = await getClinic(session.clinicId);
  const tier = getClinicTier(
    clinic ?? { subscriptionStatus: "active", trialEndsAt: 0, planTier: null }
  );
  if (!getEntitlements(tier).whatsappAutomation) redirect("/dashboard");

  const conversations = await getClinicConversations(session.clinicId);

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl font-medium text-brown-900">Inbox</h1>
      <p className="mt-2 text-sm text-brown-600">Two-way WhatsApp conversations with patients.</p>
      <div className="mt-2 mb-8 h-[2px] w-8 bg-gold-500" />

      <InboxClient initialConversations={conversations} />
    </div>
  );
}
