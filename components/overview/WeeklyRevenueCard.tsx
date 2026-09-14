"use client";

import type { WeeklyRevenue } from "@/lib/analytics";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";

function formatInr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

/** This week's revenue as a bar per day, plus today's split by treatment
 * type below it — replaces the old month-scoped RevenueChart on the
 * Dashboard (still used as-is on the dedicated Analytics page). Owner/doctor
 * only, same as StatCards. */
export default function WeeklyRevenueCard({
  weekly,
  todayByType,
  todayStr,
}: {
  weekly: WeeklyRevenue;
  todayByType: Record<string, number>;
  todayStr: string;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const maxDay = Math.max(...weekly.byDay.map((d) => d.total), 1);
  const typesWithRevenue = Object.keys(SESSION_TYPE_CONFIG).filter((t) => (todayByType[t] || 0) > 0);

  return (
    <div className="rounded-2xl border border-beige-300 bg-surface shadow-soft">
      <div className="flex items-center justify-between border-b border-beige-300 px-5 py-4">
        <h2 className="font-display text-base font-semibold text-brown-900">Weekly Revenue</h2>
        <div className="text-right">
          <div className="font-display text-lg font-bold text-brown-900">{formatInr(weekly.total)}</div>
          <div className="text-[10px] uppercase tracking-wide text-brown-400">Total</div>
        </div>
      </div>

      <div className="flex h-28 items-end gap-2 px-5 pt-5">
        {weekly.byDay.map((d) => {
          const isToday = d.dateStr === todayStr;
          return (
            <div key={d.dateStr} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-24 w-full items-end">
                <div
                  title={`${d.label}: ${formatInr(d.total)}`}
                  className={`w-full rounded-t-sm ${isToday ? "bg-rust-600" : "bg-beige-300"}`}
                  style={{ height: `${Math.max((d.total / maxDay) * 100, d.total > 0 ? 4 : 2)}%` }}
                />
              </div>
              <span className="text-[10px] font-semibold text-brown-400">{d.label}</span>
            </div>
          );
        })}
      </div>

      <div className="px-5 pb-5 pt-4">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-brown-400">
          Today&apos;s Breakdown
        </div>
        {typesWithRevenue.length === 0 ? (
          <p className="pt-2 text-xs text-brown-400">No revenue logged yet today.</p>
        ) : (
          <div>
            {typesWithRevenue.map((t) => (
              <div
                key={t}
                className="flex justify-between border-t border-beige-300 py-2 text-xs first:border-t-0"
              >
                <span className="text-brown-600">{SESSION_TYPE_CONFIG[t].label}</span>
                <span className="font-semibold text-brown-900">{formatInr(todayByType[t] || 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
