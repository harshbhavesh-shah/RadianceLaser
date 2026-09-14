import { CalendarCheck, IndianRupee } from "lucide-react";
import { formatTime12h } from "@/lib/calendar";

function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

/** The two at-a-glance numbers above today's schedule — how busy today is
 * and what it's earned so far. Owner/doctor only (see app/dashboard/page.tsx),
 * same reasoning reception never saw the old Revenue section either. */
export default function StatCards({
  appointmentCount,
  nextAppointment,
  revenueToday,
  changePct,
}: {
  appointmentCount: number;
  nextAppointment: { patientName: string; time: string } | null;
  revenueToday: number;
  changePct: number | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-beige-300 bg-surface p-5 shadow-soft">
        <div className="flex items-center gap-2 text-xs font-semibold text-brown-400">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rust-100 text-rust-700">
            <CalendarCheck size={13} />
          </span>
          Appointments
        </div>
        <div className="mt-2.5 flex items-baseline gap-2">
          <span className="font-display text-3xl font-bold text-brown-900">{appointmentCount}</span>
          <span className="text-sm text-brown-400">total today</span>
        </div>
        {nextAppointment && (
          <div className="mt-3 border-t border-beige-300 pt-3 text-xs text-brown-600">
            <span className="font-semibold text-brown-900">Next:</span> {nextAppointment.patientName} at{" "}
            {formatTime12h(nextAppointment.time)}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-beige-300 bg-surface p-5 shadow-soft">
        <div className="flex items-center gap-2 text-xs font-semibold text-brown-400">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rust-100 text-rust-700">
            <IndianRupee size={13} />
          </span>
          Revenue Today
        </div>
        <div className="mt-2.5 font-display text-3xl font-bold text-brown-900">{formatInr(revenueToday)}</div>
        {changePct !== null && (
          <div
            className={`mt-3 border-t border-beige-300 pt-3 text-xs font-semibold ${
              changePct >= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {changePct >= 0 ? "↗" : "↘"} {Math.abs(changePct)}% from yesterday
          </div>
        )}
      </div>
    </div>
  );
}
