import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getClinicAppointments, getRecentNoShowAppointments } from "@/lib/db/appointments";
import { getClinicNoShowFollowUps } from "@/lib/db/noShowFollowUps";
import { getClinicNoShowMessageLog } from "@/lib/db/noShowMessageLog";
import { getClinicNoShowSurveyResponses } from "@/lib/db/noShowSurvey";
import { getClinicMessageTemplates } from "@/lib/db/messageTemplates";
import { getWhatsAppConnection } from "@/lib/db/whatsapp";
import { computeNoShowStats, computeNoShowTrend } from "@/lib/analyticsPage";
import { getClinic } from "@/lib/db/clinics";
import { getClinicTier, getEntitlements } from "@/lib/entitlements";
import { getVisitsWithFollowUpBetween } from "@/lib/db/visits";
import { getPatientsByIds } from "@/lib/db/patients";
import { getClinicSessionTypeDefs } from "@/lib/db/sessionTypeDefs";
import { buildSessionTypeConfig } from "@/lib/sessionTypes";
import { todayLocalStr, toDateStr, addDays, parseDateStr } from "@/lib/calendar";
import PatientRetentionTabs from "@/components/patients-config/PatientRetentionTabs";
import type { FollowUpRow } from "@/components/follow-ups/FollowUpList";
import type { Visit } from "@/types";

function formatDayLabel(dateStr: string): string {
  return parseDateStr(dateStr).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export default async function PatientRetentionPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/api/auth/force-logout");

  const clinic = await getClinic(session.clinicId);
  const tier = getClinicTier(
    clinic ?? { subscriptionStatus: "active", trialEndsAt: 0, planTier: null }
  );
  if (!getEntitlements(tier).patientRetention) redirect("/dashboard");

  const today = todayLocalStr();
  const tomorrow = toDateStr(addDays(new Date(), 1));

  const [
    allAppointments,
    recentNoShows,
    noShowFollowUps,
    messageLog,
    surveyResponses,
    templates,
    connection,
    followUpVisits,
    sessionTypeDefs,
  ] = await Promise.all([
    getClinicAppointments(session.clinicId),
    getRecentNoShowAppointments(session.clinicId),
    getClinicNoShowFollowUps(session.clinicId),
    getClinicNoShowMessageLog(session.clinicId),
    getClinicNoShowSurveyResponses(session.clinicId),
    getClinicMessageTemplates(session.clinicId),
    getWhatsAppConnection(session.clinicId),
    getVisitsWithFollowUpBetween(session.clinicId, today, tomorrow),
    getClinicSessionTypeDefs(session.clinicId),
  ]);

  const stats = computeNoShowStats(allAppointments);
  const trend = computeNoShowTrend(allAppointments);
  const isOwner = session.role === "owner";
  const isWhatsAppConnected = connection?.status === "connected";
  const sessionTypeConfig = buildSessionTypeConfig(sessionTypeDefs);

  const patientIds = [...new Set(followUpVisits.map((v) => v.patientId))];
  const patients = await getPatientsByIds(patientIds);
  const patientsById = new Map(patients.map((p) => [p.id, p]));

  function rowsFor(dateStr: string): FollowUpRow[] {
    return followUpVisits
      .filter((v: Visit) => v.followUpDate === dateStr)
      .map((visit) => ({
        visit,
        patientName: patientsById.get(visit.patientId)?.name || "Unknown patient",
        patientPhone: patientsById.get(visit.patientId)?.phone || "",
      }))
      .sort((a, b) => a.patientName.localeCompare(b.patientName));
  }

  return (
    <div className="max-w-6xl">
      <h1 className="mb-8 inline-block border-b-4 border-rust-600 pb-1 font-display text-2xl font-bold text-brown-900">
        Patient Retention
      </h1>

      <PatientRetentionTabs
        stats={stats}
        trend={trend}
        recentNoShows={recentNoShows}
        noShowFollowUps={noShowFollowUps}
        messageLog={messageLog}
        surveyResponses={surveyResponses}
        templates={templates}
        isWhatsAppConnected={isWhatsAppConnected}
        isOwner={isOwner}
        todayLabel={formatDayLabel(today)}
        tomorrowLabel={formatDayLabel(tomorrow)}
        todayRows={rowsFor(today)}
        tomorrowRows={rowsFor(tomorrow)}
        sessionTypeConfig={sessionTypeConfig}
        initialTab={searchParams.tab === "follow-ups" ? "follow-ups" : undefined}
      />
    </div>
  );
}
