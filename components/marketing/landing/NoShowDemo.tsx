"use client";

import { useEffect, useState } from "react";
import { Eyebrow, H2_CLASS, Wrap } from "./ui";

// Twelve weekly no-show counts: the first six are the "before" baseline,
// the last six depend on how many follow-ups are switched on (0 to 3).
// Illustrative, not computed from anything real; the percentages below are
// the canned headline for each state. The whole chart is plain divs, so the
// landing page doesn't ship a charting library.
const BEFORE = [9, 11, 8, 10, 12, 9];
const AFTER_BY_ACTIVE_COUNT = [
  [10, 9, 11, 10, 9, 10],
  [9, 9, 8, 8, 8, 8],
  [8, 7, 7, 7, 7, 6],
  [7, 6, 6, 5, 5, 5],
];
const TARGET_PERCENT = [0, 15, 28, 42];
const BAR_PX_PER_UNIT = 13;

const FOLLOW_UPS = [
  { name: "Ask why", what: "A gentle note the same evening" },
  { name: "Win-back offer", what: "Sent after two missed sittings" },
  { name: "Reschedule nudge", what: "Three open slots, one tap to book" },
];

function AnimatedPercentage({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    const start = displayValue;
    if (start === value) return;

    const duration = 600;
    const startTime = performance.now();
    let frame: number;

    function animate(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(Math.round(start + (value - start) * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
    // Only restarts when the target changes; displayValue is the animation's own output.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span>{displayValue === 0 ? "0%" : `−${displayValue}%`}</span>;
}

/** "Turn on a follow-up, watch the no-show rate drop": every number is
 * canned (see above), but the toggles and the chart are real interactivity,
 * not a static image. */
export default function NoShowDemo() {
  const [enabled, setEnabled] = useState([true, false, true]);
  const activeCount = enabled.filter(Boolean).length;
  const bars = [
    ...BEFORE.map((v) => ({ v, after: false })),
    ...AFTER_BY_ACTIVE_COUNT[activeCount].map((v) => ({ v, after: true })),
  ];
  const targetPercent = TARGET_PERCENT[activeCount];

  function toggle(index: number) {
    setEnabled((prev) => prev.map((on, i) => (i === index ? !on : on)));
  }

  return (
    <section className="bg-lumi-sand">
      <Wrap className="flex flex-col gap-10 py-16 md:gap-14 md:py-[120px]">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end lg:gap-16">
          <div className="flex max-w-[700px] flex-col gap-7">
            <Eyebrow>NO-SHOWS</Eyebrow>
            <h2 className={H2_CLASS}>Know who is missing appointments. Do something about it.</h2>
          </div>
          <div className="flex flex-col gap-1 lg:items-end">
            <span
              aria-live="polite"
              className="text-[80px] font-medium leading-[0.9] tracking-[-0.06em] text-lumi-accent sm:text-[104px] lg:text-[120px]"
            >
              <AnimatedPercentage value={targetPercent} />
            </span>
            <span className="max-w-[300px] font-landing-mono text-[11px] tracking-[0.1em] text-lumi-soft lg:text-right">
              {targetPercent === 0
                ? "TURN ON A FOLLOW-UP TO SEE THE EFFECT"
                : "AVERAGE NO-SHOW RATE AFTER ENABLING FOLLOW-UPS"}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row">
          <div className="flex flex-grow flex-col gap-6 rounded-2xl bg-lumi-card px-5 py-6 sm:px-8 sm:py-7">
            <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
              <span className="text-base font-semibold">No-shows by week</span>
              <div className="flex gap-5 font-landing-mono text-[10px] tracking-[0.08em] text-lumi-mute">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-[#C9BFAE]" />
                  BEFORE
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm bg-lumi-accent" />
                  WITH FOLLOW-UPS
                </span>
              </div>
            </div>
            <div
              role="img"
              aria-label={`Weekly no-shows: about ${BEFORE[0]} a week before follow-ups, dropping to about ${
                AFTER_BY_ACTIVE_COUNT[activeCount][5]
              } with them`}
              className="flex h-[200px] items-end gap-1.5 border-b border-lumi-ink/15 sm:gap-3.5"
            >
              {bars.map((b, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="font-landing-mono text-[10px] text-lumi-mute">{b.v}</span>
                  <div
                    className={`w-full rounded-t transition-[height] duration-500 ease-out ${
                      b.after ? "bg-lumi-accent" : "bg-[#C9BFAE]"
                    }`}
                    style={{ height: b.v * BAR_PX_PER_UNIT }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between font-landing-mono text-[10px] tracking-[0.08em] text-lumi-faint">
              <span>WK 01</span>
              <span className="hidden sm:inline">FOLLOW-UPS ON &uarr; WK 07</span>
              <span>WK 12</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 rounded-2xl bg-lumi-ink p-7 text-lumi-paper lg:w-[400px] lg:shrink-0">
            <span className="pb-3.5 font-landing-mono text-[11px] tracking-[0.12em] text-lumi-faint">
              AUTOMATIC FOLLOW-UP
            </span>
            {FOLLOW_UPS.map((f, i) => (
              <button
                key={f.name}
                type="button"
                role="switch"
                aria-checked={enabled[i]}
                onClick={() => toggle(i)}
                className="flex items-center gap-4 border-t border-lumi-paper/[0.12] py-[18px] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-lumi-ember"
              >
                <span className="flex flex-grow flex-col gap-1">
                  <span className="text-[17px] font-medium">{f.name}</span>
                  <span className="text-[13px] text-lumi-stone">{f.what}</span>
                </span>
                <span
                  className={`flex h-6 w-10 shrink-0 items-center rounded-full px-[3px] transition-colors ${
                    enabled[i] ? "justify-end bg-lumi-ember" : "justify-start bg-lumi-soft"
                  }`}
                >
                  <span className="h-[18px] w-[18px] rounded-full bg-lumi-paper" />
                </span>
              </button>
            ))}
          </div>
        </div>
      </Wrap>
    </section>
  );
}
