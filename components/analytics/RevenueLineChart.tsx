"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RevenueSeriesPoint } from "@/lib/analyticsRange";

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

// Short axis-label form — ₹0 stays ₹0, everything at or above ₹1,000
// abbreviates to "₹Xk" (one decimal only when it isn't a whole thousand)
// so the y-axis never crowds with full rupee figures.
function formatAxisValue(n: number): string {
  if (n < 1000) return `₹${Math.round(n)}`;
  const thousands = n / 1000;
  return `₹${thousands % 1 === 0 ? thousands : thousands.toFixed(1)}k`;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-beige-300 bg-surface px-3.5 py-2.5 shadow-card">
      <p className="text-xs font-semibold text-brown-900">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-rust-600">Revenue : {formatCurrency(payload[0].value)}</p>
    </div>
  );
}

// Shows at most ~7 x-axis labels so a long custom range doesn't crowd into
// unreadable text — every Nth tick, matching the old hand-rolled chart's
// same reasoning (see git history), just expressed as Recharts' own
// tick-interval prop instead of hand-picking which labels to render.
function tickInterval(pointCount: number): number {
  return Math.max(0, Math.ceil(pointCount / 7) - 1);
}

/** Revenue over the selected date range — a smooth (monotone) line with
 * a dashed gridline, hollow point markers that fill solid on hover, and a
 * small tooltip card, matching the Figma design's own Recharts-based
 * chart exactly (design/DashboardOverviewDesign/src/App.tsx Analytics())
 * rather than the hand-rolled straight-segment SVG this used to be. */
export default function RevenueLineChart({ points }: { points: RevenueSeriesPoint[] }) {
  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAE5DE" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval={tickInterval(points.length)}
            tick={{ fill: "#9C8672", fontSize: 11, fontWeight: 600 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={56}
            tick={{ fill: "#9C8672", fontSize: 11, fontWeight: 600 }}
            tickFormatter={formatAxisValue}
          />
          <Tooltip cursor={{ stroke: "#C1694F", strokeDasharray: "3 3" }} content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey="total"
            stroke="#C1694F"
            strokeWidth={3}
            dot={{ r: 4, fill: "#FFFFFF", stroke: "#C1694F", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "#C1694F", stroke: "#FFFFFF", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
