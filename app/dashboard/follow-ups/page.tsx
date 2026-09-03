import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getVisitsWithFollowUpBetween } from "@/lib/db/visits";
import { getPatientsByIds } from "@/lib/db/patients";
import { getClinicSessionTypeDefs } from "@/lib/db/sessionTypeDefs";
import { buildSessionTypeConfig } from "@/lib/sessionTypes";
import { todayLocalStr, toDateStr, addDays, parseDateStr } from "@/lib/calendar";
import FollowUpList, { type FollowUpRow } from "@/components/follow-ups/FollowUpList";
import type { Visit } from "@/types";

function formatDayLabel(dateStr: string): string {
  return parseDateStr(dateStr).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

// A plain server component — every request recomputes "today" fresh, so
// there's nothing to schedule or cache for this to "refresh daily." It
// just reads Visit.followUpDate/followUpNote (set from VisitFormModal),
// no new schema, since that data already existed and just wasn't surfaced
// anywhere on its own before this page.
export default async function FollowUpsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const today = todayLocalStr();
  const tomorrow = toDateStr(addDays(new Date(), 1));

  const [visits, sessionTypeDefs] = await Promise.all([
    getVisitsWithFollowUpBetween(session.clinicId, today, tomorrow),
    getClinicSessionTypeDefs(session.clinicId),
  ]);
  const SESSION_TYPE_CONFIG = buildSessionTypeConfig(sessionTypeDefs);

  const patientIds = [...new Set(visits.map((v) => v.patientId))];
  const patients = await getPatientsByIds(patientIds);
  const patientsById = new Map(patients.map((p) => [p.id, p]));

  function rowsFor(dateStr: string): FollowUpRow[] {
    return visits
      .filter((v: Visit) => v.followUpDate === dateStr)
      .map((visit) => ({
        visit,
        patientName: patientsById.get(visit.patientId)?.name || "Unknown patient",
        patientPhone: patientsById.get(visit.patientId)?.phone || "",
      }))
      .sort((a, b) => a.patientName.localeCompare(b.patientName));
  }

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl font-medium text-brown-900">Follow-Ups</h1>
      <p className="mt-2 text-sm text-brown-600">Patients due for a follow-up call, today and tomorrow.</p>
      <div className="mt-2 mb-8 h-[2px] w-8 bg-gold-500" />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <FollowUpList
          title="Today"
          dateLabel={formatDayLabel(today)}
          rows={rowsFor(today)}
          sessionTypeConfig={SESSION_TYPE_CONFIG}
        />
        <FollowUpList
          title="Tomorrow"
          dateLabel={formatDayLabel(tomorrow)}
          rows={rowsFor(tomorrow)}
          sessionTypeConfig={SESSION_TYPE_CONFIG}
        />
      </div>
    </div>
  );
}
