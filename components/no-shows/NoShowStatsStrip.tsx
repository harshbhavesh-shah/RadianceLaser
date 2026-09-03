import type { NoShowStats, NoShowWeekPoint } from "@/lib/analyticsPage";

/** This-week/this-month counts + rate, plus a weekly trend chart in the
 * same style as RevenueChart.tsx. */
export default function NoShowStatsStrip({ stats, trend }: { stats: NoShowStats; trend: NoShowWeekPoint[] }) {
  const maxCount = Math.max(...trend.map((w) => w.count), 1);

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div>
          <div className="font-display text-3xl font-medium text-brown-900">{stats.thisWeek}</div>
          <div className="text-xs text-brown-400">No shows this week</div>
        </div>
        <div>
          <div className="font-display text-3xl font-medium text-brown-900">{stats.thisMonth}</div>
          <div className="text-xs text-brown-400">No shows this month</div>
        </div>
        <div>
          <div className="font-display text-3xl font-medium text-brown-900">{stats.monthRate.toFixed(0)}%</div>
          <div className="text-xs text-brown-400">No show rate this month</div>
        </div>
      </div>

      <div className="mt-6 border-t border-beige-300 pt-5">
        <div className="mb-2.5 text-xs font-medium uppercase tracking-wide text-brown-400">
          Weekly Trend
        </div>
        <div className="flex h-24 items-end gap-1.5">
          {trend.map((w, i) => (
            <div key={w.weekLabel} title={`Week of ${w.weekLabel}: ${w.count}`} className="group relative min-w-0 flex-1">
              <div
                className="animate-grow-y w-full rounded-t-sm bg-gold-500 transition-colors group-hover:bg-gold-600"
                style={{
                  height: `${Math.max((w.count / maxCount) * 100, w.count > 0 ? 4 : 1)}px`,
                  animationDelay: `${i * 20}ms`,
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-brown-400">
          <span>{trend[0]?.weekLabel}</span>
          <span>{trend[trend.length - 1]?.weekLabel}</span>
        </div>
      </div>
    </div>
  );
}
