import type { NoShowStats, NoShowWeekPoint } from "@/lib/analyticsPage";

/** This-week/this-month/rate counts as two mini stat cards, plus a weekly
 * trend chart below — a week with zero no-shows gets a small dot instead
 * of an invisible zero-height bar, so the trend line still reads at a
 * glance even across quiet weeks.
 *
 * hideMonthRate: the Analytics page (ProceduralAnalytics) already has its
 * own no-show-rate KPI tile, driven by that page's date-range selector —
 * this strip's own rate tile is always calendar-month-fixed regardless of
 * that selector, so showing both there reads as two competing numbers
 * (they only agree when "This Month" is the selected range). The Patient
 * Retention page has no such KPI elsewhere, so it keeps both tiles. */
export default function NoShowStatsStrip({
  stats,
  trend,
  hideMonthRate,
}: {
  stats: NoShowStats;
  trend: NoShowWeekPoint[];
  hideMonthRate?: boolean;
}) {
  const maxCount = Math.max(...trend.map((w) => w.count), 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1 rounded-[18px] bg-surface p-6 shadow-soft">
          <div className="text-3xl font-extrabold text-brown-900">{stats.thisMonth}</div>
          <div className="mt-1 text-sm font-semibold text-brown-400">
            No shows this month &middot; {stats.thisWeek} this week
          </div>
        </div>
        {!hideMonthRate && (
          <div className="flex-1 rounded-[18px] bg-surface p-6 shadow-soft">
            <div className="text-3xl font-extrabold text-brown-900">{stats.monthRate.toFixed(0)}%</div>
            <div className="mt-1 text-sm font-semibold text-brown-400">No show rate this month</div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3.5 rounded-[18px] bg-surface p-8 shadow-soft">
        <div className="text-xs font-bold uppercase tracking-[0.05em] text-brown-400">Weekly Trend</div>

        <div className="relative flex h-[170px] items-end gap-[18px] px-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-beige-200" />
          <div className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-beige-200" />
          <div className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-beige-200" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-beige-300" />

          {trend.map((w) => (
            <div
              key={w.weekLabel}
              title={`Week of ${w.weekLabel}: ${w.count}`}
              className="flex h-full flex-1 items-end justify-center"
            >
              {w.count > 0 ? (
                <div
                  className="w-full max-w-[34px] rounded-t-md bg-rust-600 transition-colors hover:bg-rust-700"
                  style={{ height: `${Math.max((w.count / maxCount) * 100, 4)}%` }}
                />
              ) : (
                <div className="mb-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-rust-600/30" />
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-between px-1 text-xs font-semibold text-brown-400">
          <span>{trend[0]?.weekLabel}</span>
          <span>{trend[trend.length - 1]?.weekLabel}</span>
        </div>
      </div>
    </div>
  );
}
