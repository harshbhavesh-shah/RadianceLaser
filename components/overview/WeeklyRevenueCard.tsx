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
    <div className="rounded-[18px] border border-beige-300 bg-surface p-6 shadow-soft">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="mb-1 text-xl font-extrabold text-brown-900">Weekly Revenue</h2>
          <p className="text-sm font-medium text-brown-400">Last 7 days performance</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-extrabold text-brown-900">{formatInr(weekly.total)}</span>
          <p className="text-xs font-semibold text-brown-400">Total</p>
        </div>
      </div>

      <div className="flex h-56 items-end gap-2">
        {weekly.byDay.map((d) => {
          const isToday = d.dateStr === todayStr;
          return (
            <div key={d.dateStr} className="flex h-full flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end">
                <div
                  title={`${d.label}: ${formatInr(d.total)}`}
                  className={`w-full rounded-t-md ${isToday ? "bg-rust-600" : "bg-beige-300"}`}
                  style={{ height: `${Math.max((d.total / maxDay) * 100, d.total > 0 ? 4 : 2)}%` }}
                />
              </div>
              <span className="text-[10px] font-semibold text-brown-400">{d.label}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 border-t border-beige-300 pt-6">
        <h3 className="mb-4 text-sm font-bold text-brown-900">Today&apos;s Breakdown</h3>
        {typesWithRevenue.length === 0 ? (
          <p className="text-xs text-brown-400">No revenue logged yet today.</p>
        ) : (
          <div className="space-y-3">
            {typesWithRevenue.map((t) => (
              <div key={t} className="flex items-center justify-between text-sm">
                <span className="font-semibold text-brown-400">{SESSION_TYPE_CONFIG[t].label}</span>
                <span className="font-extrabold text-brown-900">{formatInr(todayByType[t] || 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
