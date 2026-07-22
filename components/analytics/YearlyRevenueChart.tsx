import type { MonthPoint } from "@/lib/analyticsPage";

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

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
                height: `${Math.max((point.total / max) * 100, point.total > 0 ? 4 : 1)}%`,
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
