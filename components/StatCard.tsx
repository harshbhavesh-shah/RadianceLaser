export default function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl bg-surface p-5 shadow-soft ring-1 ring-beige-300">
      <div className="text-xs font-medium uppercase tracking-wide text-brown-400">{label}</div>
      <div
        className={`mt-1.5 font-display text-2xl font-medium ${accent ? "text-gold-600" : "text-brown-900"}`}
      >
        {value}
      </div>
    </div>
  );
}
