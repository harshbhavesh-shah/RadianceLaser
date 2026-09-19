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

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
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
    <div className="flex flex-col gap-4 rounded-[18px] bg-surface p-7 shadow-soft">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-xl font-extrabold text-brown-900">Recent No Shows</h2>
        <p className="text-[13px] font-semibold text-brown-400">Last 30 days, most recent first.</p>
      </div>

      {appointments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-beige-300 py-8 text-center text-sm font-semibold text-brown-400">
          No no shows in the last 30 days.
        </p>
      ) : (
        <div className="flex flex-col">
          {appointments.map((appt, i) => {
            const sent = sentByAppointment.get(appt.id);
            const survey = surveyByAppointment.get(appt.id);
            const ago = daysAgo(appt.date);
            return (
              <div
                key={appt.id}
                className={`flex items-center gap-3.5 py-3.5 ${
                  i < appointments.length - 1 ? "border-b border-beige-100" : ""
                }`}
              >
                <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full bg-beige-200 text-[13px] font-bold text-rust-700">
                  {initialsOf(appt.patientName)}
                </div>
                <div className="min-w-0 flex-1">
                  {appt.patientId ? (
                    <Link
                      href={`/dashboard/patients/${appt.patientId}`}
                      className="block truncate text-[15px] font-bold text-brown-900 hover:text-rust-600"
                    >
                      {appt.patientName}
                    </Link>
                  ) : (
                    <span className="block truncate text-[15px] font-bold text-brown-900">{appt.patientName}</span>
                  )}
                  <span className="text-[13px] font-medium text-brown-400">
                    {appt.date} &middot; {appt.time}
                  </span>
                  {(survey?.reason || (followUps.length > 0 && sent)) && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {survey?.reason && (
                        <span className="text-xs text-brown-600">
                          <span className="font-semibold">Reason:</span>{" "}
                          {REASON_LABELS[survey.reason] || survey.reason}
                          {survey.comment && <span>. &quot;{survey.comment}&quot;</span>}
                        </span>
                      )}
                      {followUps.map(
                        (f) =>
                          sent?.has(f.id) && (
                            <span
                              key={f.id}
                              className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700"
                            >
                              {f.name} sent
                            </span>
                          )
                      )}
                    </div>
                  )}
                </div>
                <span
                  className={`flex-shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${
                    i === 0 ? "bg-[#FBEEE9] text-rust-700" : "bg-beige-100 text-brown-400"
                  }`}
                >
                  {ago}d ago
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
