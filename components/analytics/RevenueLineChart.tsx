import type { RevenueSeriesPoint } from "@/lib/analyticsRange";

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

const WIDTH = 760;
const HEIGHT = 220;
const PAD_X = 10;
const PAD_TOP = 16;
const PAD_BOTTOM = 10;

/** Revenue over the selected date range as a line, replacing the old
 * fixed-12-month bar chart for this view — points are whatever
 * lib/analyticsRange.ts computeRevenueSeries bucketed the range into
 * (daily or weekly), so this scales to however many points that produced
 * rather than assuming a fixed count. */
export default function RevenueLineChart({ points }: { points: RevenueSeriesPoint[] }) {
  const max = Math.max(...points.map((p) => p.total), 1);
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const step = points.length > 1 ? (WIDTH - PAD_X * 2) / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: PAD_X + i * step,
    y: PAD_TOP + plotHeight - (p.total / max) * plotHeight,
    ...p,
  }));

  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");

  // Show at most ~7 x-axis labels so a long custom range doesn't crowd
  // into unreadable text — every Nth point, always including the last.
  const labelEvery = Math.max(1, Math.ceil(coords.length / 7));

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ height: HEIGHT }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={0}
            x2={WIDTH}
            y1={PAD_TOP + plotHeight * f}
            y2={PAD_TOP + plotHeight * f}
            stroke="#ECE7DD"
            strokeDasharray="3 4"
          />
        ))}
        {coords.length > 1 && <path d={path} fill="none" stroke="#C1442D" strokeWidth={2.5} strokeLinecap="round" />}
        {coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={3.5} fill="#fff" stroke="#C1442D" strokeWidth={2.5}>
            <title>
              {c.label}: {formatCurrency(c.total)}
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-1.5 flex justify-between text-[10px] font-medium text-brown-400">
        {coords.map((c, i) =>
          i % labelEvery === 0 || i === coords.length - 1 ? <span key={i}>{c.label}</span> : <span key={i} />
        )}
      </div>
    </div>
  );
}
