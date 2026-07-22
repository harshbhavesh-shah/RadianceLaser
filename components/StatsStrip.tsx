export interface StatStripItem {
  label: string;
  value: string | number;
  sublabel?: string;
  accent?: boolean;
}

/** A single slim strip of stat figures, separated by thin dividers, instead
 * of a grid of separate boxy cards. Used on both the Overview and Analytics
 * pages. Entrance is a quick staggered fade — pure CSS (see globals.css),
 * so this works fine as a Server Component. */
export default function StatsStrip({ items }: { items: StatStripItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl bg-surface shadow-soft ring-1 ring-beige-300">
      <div className="grid grid-cols-2 divide-x divide-y divide-beige-300 sm:grid-cols-4 sm:divide-y-0">
        {items.map((item, i) => (
          <div
            key={item.label}
            className="animate-fade-up px-5 py-4"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="text-xs font-medium uppercase tracking-wide text-brown-400">
              {item.label}
            </div>
            <div
              className={`mt-1.5 font-display text-2xl font-medium ${item.accent ? "text-gold-600" : "text-brown-900"}`}
            >
              {item.value}
            </div>
            {item.sublabel && <div className="mt-1.5 text-[11px] text-brown-400">{item.sublabel}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
