import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getClinicConversations } from "@/lib/db/whatsappConversations";
import InboxClient from "@/components/inbox/InboxClient";

export default async function InboxPage() {
  const session = await getSession();
  if (!session) redirect("/login");

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
