interface PieSegment {
  label: string;
  value: number;
  color: string;
  // Shown as the legend's second line under the count, e.g. "appointments"
  // — omit for the plain currency-with-percentage legend style.
  sublabel?: string;
}

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function PieChart({
  segments,
  size = 160,
  strokeWidth = 26,
  formatValue = formatCurrency,
  centerLabel,
}: {
  segments: PieSegment[];
  size?: number;
  strokeWidth?: number;
  // Defaults to currency (the "By Treatment Type" use case) — pass a plain
  // integer formatter for a counts-based donut like Appointment Status.
  formatValue?: (n: number) => string;
  // Renders inside the donut's hole, e.g. { value: "167", caption: "TOTAL" }
  // — omit for a plain ring with no center content.
  centerLabel?: { value: string; caption: string };
}) {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="animate-scale-in -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#E8DDC9"
            strokeWidth={strokeWidth}
          />
          {total > 0 &&
            segments.map((seg, i) => {
              if (seg.value <= 0) return null;
              const fraction = seg.value / total;
              const dashLength = fraction * circumference;
              const offset = -cumulative;
              cumulative += dashLength;
              return (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dashLength} ${circumference - dashLength}`}
                  strokeDashoffset={offset}
                />
              );
            })}
        </svg>
        {centerLabel && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-2xl font-bold text-brown-900">{centerLabel.value}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-brown-400">
              {centerLabel.caption}
            </span>
          </div>
        )}
      </div>
      <div className="space-y-2.5">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="animate-fade-up flex items-center gap-2.5 text-sm"
            style={{ animationDelay: `${150 + i * 70}ms` }}
          >
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
            <div>
              <div className="text-brown-700">{seg.label}</div>
              <div className="font-medium text-brown-900">
                {formatValue(seg.value)}
                {seg.sublabel ? ` ${seg.sublabel}` : total > 0 ? ` (${Math.round((seg.value / total) * 100)}%)` : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
