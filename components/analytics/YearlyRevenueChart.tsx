import type { MonthPoint } from "@/lib/analyticsPage";

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

// Matches the h-40 container below. Bar heights are set in px scaled
// against this, not a CSS percentage — a percentage height only resolves
// against a parent with a *definite* height, and the immediate parent here
// (the flex-1 wrapper) has none: the outer flex row uses items-end, which
// sizes each item to its content instead of stretching it, so a
// percentage-height child inside it always computes to 0 (confirmed via
// getComputedStyle while debugging — the bars silently never rendered).
// components/RevenueChart.tsx's daily bars use the same px-based workaround.
const CHART_HEIGHT_PX = 160;

export default function YearlyRevenueChart({ data }: { data: MonthPoint[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <div>
      <div className="flex h-40 items-end gap-2">
        {data.map((point, i) => (
          <div
            key={point.monthLabel}
            title={`${point.monthLabel}: ${formatCurrency(point.total)}`}
            className="group flex-1"
          >
            <div
              className="animate-grow-y w-full rounded-t-sm bg-gold-500 transition-colors group-hover:bg-gold-600"
              style={{
                height: `${Math.max((point.total / max) * CHART_HEIGHT_PX, point.total > 0 ? 4 : 1)}px`,
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
