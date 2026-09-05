interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

// Same ring-drawing technique as components/analytics/PieChart, kept as a
// separate component since that one's legend hardcodes currency formatting
// — this needs a plain count ("3 clinics"), not "₹3".
export default function AdminDonutChart({
  segments,
  size = 160,
  strokeWidth = 26,
  formatValue = (n: number) => String(n),
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  formatValue?: (n: number) => string;
}) {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="animate-scale-in -rotate-90 flex-shrink-0">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E8DDC9" strokeWidth={strokeWidth} />
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
      <div className="space-y-2.5">
        {segments.map((seg, i) => (
          <div key={i} className="animate-fade-up flex items-center gap-2.5 text-sm" style={{ animationDelay: `${150 + i * 70}ms` }}>
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-brown-700">{seg.label}</span>
            <span className="font-medium text-brown-900">
              {formatValue(seg.value)}
              {total > 0 && <span className="ml-1 text-brown-400">({Math.round((seg.value / total) * 100)}%)</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
