import type { MonthPoint } from "@/lib/analyticsPage";

// Same px-based height workaround as components/analytics/YearlyRevenueChart
// — a percentage height inside an items-end flex row always resolves to 0
// (the parent has no definite height), so bars are sized in px instead.
const CHART_HEIGHT_PX = 160;

export default function AdminBarChart({
  data,
  color = "#8C6A24",
  formatValue = (n: number) => n.toLocaleString("en-IN"),
}: {
  data: MonthPoint[];
  color?: string;
  formatValue?: (n: number) => string;
}) {
  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <div>
      <div className="flex h-40 items-end gap-2">
        {data.map((point, i) => (
          <div key={point.monthLabel} title={`${point.monthLabel}: ${formatValue(point.total)}`} className="group flex-1">
            <div
              className="animate-grow-y w-full rounded-t-sm transition-opacity group-hover:opacity-80"
              style={{
                height: `${Math.max((point.total / max) * CHART_HEIGHT_PX, point.total > 0 ? 4 : 1)}px`,
                backgroundColor: color,
                animationDelay: `${i * 40}ms`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {data.map((point) => (
          <div key={point.monthLabel} className="flex-1 text-center text-[10px] text-brown-400">
            {point.monthLabel}
          </div>
        ))}
      </div>
    </div>
  );
}
