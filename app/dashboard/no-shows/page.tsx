import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getClinicAppointments, getRecentNoShowAppointments } from "@/lib/db/appointments";
import { getClinicNoShowFollowUps } from "@/lib/db/noShowFollowUps";
import { getClinicNoShowMessageLog } from "@/lib/db/noShowMessageLog";
import { getClinicNoShowSurveyResponses } from "@/lib/db/noShowSurvey";
import { getClinicMessageTemplates } from "@/lib/db/messageTemplates";
import { getWhatsAppConnection } from "@/lib/db/whatsapp";
import { computeNoShowStats, computeNoShowTrend } from "@/lib/analyticsPage";
import NoShowStatsStrip from "@/components/no-shows/NoShowStatsStrip";
import NoShowList from "@/components/no-shows/NoShowList";
import FollowUpsSection from "@/components/no-shows/FollowUpsSection";

export default async function NoShowsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [allAppointments, recentNoShows, followUps, messageLog, surveyResponses, templates, connection] =
    await Promise.all([
      getClinicAppointments(session.clinicId),
      getRecentNoShowAppointments(session.clinicId),
      getClinicNoShowFollowUps(session.clinicId),
      getClinicNoShowMessageLog(session.clinicId),
      getClinicNoShowSurveyResponses(session.clinicId),
      getClinicMessageTemplates(session.clinicId),
      getWhatsAppConnection(session.clinicId),
    ]);

  const stats = computeNoShowStats(allAppointments);
  const trend = computeNoShowTrend(allAppointments);
  const isOwner = session.role === "owner";
  const isConnected = connection?.status === "connected";

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-medium text-brown-900">No Shows</h1>
      <div className="mt-2 mb-8 h-[2px] w-8 bg-gold-500" />

      <div className="space-y-6">
        <NoShowStatsStrip stats={stats} trend={trend} />

        <FollowUpsSection
          initialFollowUps={followUps}
          templates={templates}
          isConnected={isConnected}
          canEdit={isOwner}
        />

        <NoShowList
          appointments={recentNoShows}
          followUps={followUps}
          messageLog={messageLog}
          surveyResponses={surveyResponses}
        />
      </div>
    </div>
  );
}
