"use client";

import type { MonthlyRevenue } from "@/lib/analytics";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";

function formatCurrency(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function RevenueChart({ data }: { data: MonthlyRevenue }) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const maxDay = Math.max(...data.byDay.map((d) => d.total), 1);
  const types = Object.keys(SESSION_TYPE_CONFIG);
  const typeTotal = types.reduce((sum, type) => sum + (data.byType[type] || 0), 0) || 1;

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-brown-400">
            Revenue — {data.monthLabel}
          </div>
          <div className="mt-1 font-display text-3xl font-medium text-brown-900">
            {formatCurrency(data.total)}
          </div>
        </div>
      </div>

      {/* Daily bar chart */}
      <div className="mt-6 flex h-32 items-end gap-[3px]">
        {data.byDay.map((d, i) => (
          <div
            key={d.day}
            title={`${d.day}: ${formatCurrency(d.total)}`}
            className="group relative min-w-0 flex-1"
          >
            <div
              className="animate-grow-y w-full rounded-t-sm bg-gold-500 transition-colors group-hover:bg-gold-600"
              style={{
                height: `${Math.max((d.total / maxDay) * 100, d.total > 0 ? 4 : 1)}px`,
                animationDelay: `${i * 12}ms`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-brown-400">
        <span>1</span>
        <span>{data.byDay.length}</span>
      </div>

      {/* Split by treatment type — every session type with revenue this month,
          built-in Q-Switch/LHR plus any clinic-defined machine types. */}
      <div className="mt-6 border-t border-beige-300 pt-5">
        <div className="mb-2.5 text-xs font-medium uppercase tracking-wide text-brown-400">
          By Treatment Type
        </div>
        <div className="space-y-3">
          {types.map((type, i) => {
            const cfg = SESSION_TYPE_CONFIG[type];
            const amount = data.byType[type] || 0;
            const pct = Math.round((amount / typeTotal) * 100);
            return (
              <div key={type}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${cfg.badgeClassName}`}
                    >
                      {cfg.badgeText}
                    </span>
                    <span className="text-brown-700">{cfg.label}</span>
                  </span>
                  <span className="font-medium text-brown-900">{formatCurrency(amount)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-beige-200">
                  <div
                    className="animate-grow-x h-full rounded-full bg-gold-500"
                    style={{ width: `${pct}%`, animationDelay: `${i * 80}ms` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
