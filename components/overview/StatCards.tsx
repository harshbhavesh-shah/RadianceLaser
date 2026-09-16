import { CalendarCheck, IndianRupee } from "lucide-react";
import { formatTime12h } from "@/lib/calendar";

function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

/** Two separate cards (not one grid) — the dashboard redesign places the
 * Appointments card beside the page header in the left column and the
 * Revenue card alone in the right column (see app/dashboard/page.tsx's
 * xl:grid-cols-12 layout), not stacked together as a unit. */
export function AppointmentsCard({
  appointmentCount,
  nextAppointment,
}: {
  appointmentCount: number;
  nextAppointment: { patientName: string; time: string } | null;
}) {
  return (
    <div className="flex w-full items-start justify-between rounded-[18px] border border-beige-300 bg-surface px-6 py-5 shadow-soft">
      <div className="w-full">
        <p className="mb-2 flex items-center gap-2 text-sm font-bold text-brown-400">
          <CalendarCheck className="h-4 w-4" />
          Appointments
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-extrabold text-brown-900">{appointmentCount}</span>
          <span className="text-sm font-medium text-brown-400">total today</span>
        </div>
        {nextAppointment && (
          <p className="mt-3 border-t border-beige-300 pt-3 text-xs font-medium text-brown-400">
            <strong className="font-bold text-rust-600">Next:</strong> {nextAppointment.patientName} at{" "}
            {formatTime12h(nextAppointment.time)}
          </p>
        )}
      </div>
    </div>
  );
}

export function RevenueTodayCard({ revenueToday, changePct }: { revenueToday: number; changePct: number | null }) {
  return (
    <div className="flex w-full items-start justify-between rounded-[18px] border border-beige-300 bg-surface px-6 py-5 shadow-soft">
      <div className="w-full">
        <p className="mb-2 flex items-center gap-2 text-sm font-bold text-brown-400">
          <IndianRupee className="h-4 w-4" />
          Revenue Today
        </p>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-extrabold text-brown-900">{formatInr(revenueToday)}</span>
        </div>
        {changePct !== null && (
          <p
            className={`mt-3 flex items-center gap-1 border-t border-beige-300 pt-3 text-xs font-bold ${
              changePct >= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {changePct >= 0 ? "↗" : "↘"} {Math.abs(changePct)}% from yesterday
          </p>
        )}
      </div>
    </div>
  );
}
