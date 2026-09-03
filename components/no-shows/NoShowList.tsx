import Link from "next/link";
import type { Appointment, NoShowFollowUp, NoShowSurveyResponse } from "@/types";
import type { NoShowLogEntry } from "@/lib/db/noShowMessageLog";

const REASON_LABELS: Record<string, string> = {
  forgot: "Forgot",
  schedule_conflict: "Schedule conflict",
  found_elsewhere: "Found another option",
  cost: "Too expensive",
  other: "Other",
};

function daysAgo(dateStr: string): number {
  const then = new Date(`${dateStr}T00:00:00`).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - then) / (24 * 60 * 60 * 1000));
}

/** Every no show appointment from the last 30 days, with a badge per
 * follow-up showing whether it's fired, and the survey reason once
 * answered. Read-only. */
export default function NoShowList({
  appointments,
  followUps,
  messageLog,
  surveyResponses,
}: {
  appointments: Appointment[];
  followUps: NoShowFollowUp[];
  messageLog: NoShowLogEntry[];
  surveyResponses: NoShowSurveyResponse[];
}) {
  const sentByAppointment = new Map<string, Set<string>>();
  for (const entry of messageLog) {
    const set = sentByAppointment.get(entry.appointmentId) || new Set<string>();
    set.add(entry.followUpId);
    sentByAppointment.set(entry.appointmentId, set);
  }
  const surveyByAppointment = new Map(surveyResponses.map((s) => [s.appointmentId, s]));

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <h2 className="font-display text-lg font-medium text-brown-900">Recent No Shows</h2>
      <p className="mt-0.5 text-xs text-brown-400">Last 30 days, most recent first.</p>

      {appointments.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-beige-300 py-8 text-center text-sm text-brown-400">
          No no shows in the last 30 days.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {appointments.map((appt) => {
            const sent = sentByAppointment.get(appt.id);
            const survey = surveyByAppointment.get(appt.id);
            return (
              <div key={appt.id} className="rounded-lg border border-beige-300 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    {appt.patientId ? (
                      <Link
                        href={`/dashboard/patients/${appt.patientId}`}
                        className="text-sm font-medium text-brown-900 hover:text-gold-600"
                      >
                        {appt.patientName}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-brown-900">{appt.patientName}</span>
                    )}
                    <span className="ml-2 text-xs text-brown-400">
                      {appt.date} · {appt.time} · {daysAgo(appt.date)}d ago
                    </span>
                  </div>
                  {followUps.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {followUps.map((f) => (
                        <span
                          key={f.id}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            sent?.has(f.id) ? "bg-green-50 text-green-700" : "bg-beige-200 text-brown-400"
                          }`}
                        >
                          {f.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {survey?.reason && (
                  <p className="mt-1.5 text-xs text-brown-600">
                    <span className="font-medium">Reason:</span> {REASON_LABELS[survey.reason] || survey.reason}
                    {survey.comment && <span>. &quot;{survey.comment}&quot;</span>}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
