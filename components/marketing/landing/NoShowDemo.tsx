"use client";

import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

// Four canned 8-week trend lines, one per possible count of enabled
// follow-ups (0-3) — illustrative, not computed from anything real, same
// as the reference this is built from. Purely a "here's the idea" demo on
// a marketing page, not a claim about any specific clinic's numbers.
const NO_SHOW_TRENDS = [
  [18, 18, 19, 19, 20, 20, 21, 21],
  [18, 17, 17, 16, 15, 15, 14, 14],
  [18, 16, 15, 14, 12, 11, 10, 9],
  [18, 16, 17, 12, 14, 9, 8, 5],
].map((values) => values.map((value, i) => ({ week: `W${i + 1}`, value })));

const TARGET_PERCENT = [0, 15, 28, 42];

const TOGGLES = [
  { label: "Ask why" },
  { label: "Win-back offer" },
  { label: "Reschedule nudge" },
];

function AnimatedPercentage({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const start = displayValue;
    const end = value;
    if (start === end) return;

    const duration = 600;
    const startTime = performance.now();
    let frame: number;

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(Math.round(start + (end - start) * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span>-{displayValue}%</span>;
}

/** The "turn on a follow-up, watch the no-show rate drop" demo — every
 * number here is canned (see NO_SHOW_TRENDS above), but the toggle state
 * and chart swap are real interactivity, not a static image. */
export default function NoShowDemo() {
  const [toggles, setToggles] = useState([true, false, true]);
  const activeCount = toggles.filter(Boolean).length;
  const data = NO_SHOW_TRENDS[activeCount];
  const targetPercent = TARGET_PERCENT[activeCount];

  function toggle(index: number) {
    setToggles((prev) => prev.map((v, i) => (i === index ? !v : v)));
  }

  return (
    <section
      id="product"
      className="mx-auto mb-24 flex w-full max-w-[1200px] scroll-mt-24 flex-col items-center gap-12 px-4 md:mb-32 md:flex-row md:px-6 lg:gap-16"
    >
      <div className="w-full flex-1 lg:max-w-md">
        <div className="flex flex-col gap-8 rounded-[18px] border border-beige-300 bg-white p-6 shadow-soft md:p-8">
          <div className="flex flex-col">
            <span className="text-5xl font-extrabold tracking-tight text-rust-600 transition-all duration-500 md:text-6xl">
              <AnimatedPercentage value={targetPercent} />
            </span>
            <span className="mt-2 max-w-[220px] text-sm font-bold leading-relaxed text-brown-400 transition-all duration-500">
              {targetPercent === 0
                ? "Turn on a follow-up to see the effect."
                : "average no-show rate after enabling follow-ups."}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-brown-900">
              No-shows, last 8 weeks
            </span>
            <div style={{ height: 180, minHeight: 180, minWidth: 0 }} className="w-full">
              <ResponsiveContainer width="99%" height={180} minWidth={0} minHeight={0}>
                <LineChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <XAxis
                    dataKey="week"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9C8672", fontSize: 10, fontWeight: 700 }}
                    dy={10}
                  />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9C8672", fontSize: 10, fontWeight: 700 }} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#C1694F"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#FFFFFF", stroke: "#C1694F", strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-1 flex-col text-left">
        <h2 className="mb-5 text-3xl font-extrabold leading-tight tracking-tight text-brown-900 md:text-4xl lg:text-[40px]">
          Know who is missing appointments. Do something about it.
        </h2>
        <p className="text-lg font-medium leading-relaxed text-brown-400 md:text-xl">
          The No Shows page tracks how often it happens, by week and by month, so you know if it
          is actually getting better. When someone misses an appointment, Radiance can follow up
          on its own. A message asking why, an offer to win them back, or a nudge to reschedule.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {TOGGLES.map((t, index) => (
            <div
              key={t.label}
              onClick={() => toggle(index)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggle(index)}
              className="flex max-w-sm cursor-pointer select-none items-center justify-between rounded-[16px] border border-beige-300 bg-white px-5 py-4 shadow-soft transition-colors hover:border-rust-600/40"
            >
              <span className="text-sm font-bold text-brown-900">{t.label}</span>
              <div
                className={`relative flex h-6 w-11 items-center rounded-full px-1 shadow-inner transition-colors ${
                  toggles[index] ? "justify-end bg-rust-600" : "justify-start border border-beige-300 bg-beige-200"
                }`}
              >
                <div className="h-4 w-4 rounded-full bg-white shadow-sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
