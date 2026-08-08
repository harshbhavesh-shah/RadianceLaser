"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fades + slides a section in once it scrolls into view, instead of
 * everything just being there on load — the landing page's "feel alive"
 * pass. Plain CSS transition driven by an IntersectionObserver (not the
 * animate-fade-up keyframe used elsewhere in the app, which always plays
 * immediately on mount — here we deliberately hold at opacity-0 until the
 * element is actually visible, then transition once and disconnect).
 * The easing is a manual cubic-bezier (an "ease-out-expo" curve — starts
 * fast, settles gently) rather than a built-in Tailwind timing class, to
 * match the snappier, more deliberate motion feel used elsewhere (see
 * globals.css spotlight-wipe) instead of the slower, generic ease-out this
 * used before. motion-reduce: classes make this a no-op (content just
 * appears, no animation) for anyone with reduced-motion preferences.
 */
export default function Reveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 motion-reduce:scale-100 ${
        visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-[0.985]"
      } ${className}`}
      style={{ transitionDelay: visible ? `${delayMs}ms` : "0ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
    >
      {children}
    </div>
  );
}
