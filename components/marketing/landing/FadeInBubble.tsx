"use client";

import { useEffect, useRef, useState } from "react";

/** Fades and slides a chat bubble in once it scrolls into view, then stops
 * watching it, purely decorative (see WhatsAppScrollSection) — an
 * IntersectionObserver rather than a scroll listener so it costs nothing
 * once every bubble on the page has already fired. */
export default function FadeInBubble({
  children,
  delay = 0,
  align = "left",
}: {
  children: React.ReactNode;
  delay?: number;
  align?: "left" | "right" | "center";
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { root: null, rootMargin: "0px", threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.unobserve(el);
  }, []);

  return (
    <div
      ref={ref}
      className={`flex w-full transition-all duration-1000 ease-out ${
        align === "right" ? "justify-end" : align === "left" ? "justify-start" : "justify-center"
      }`}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(40px)",
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
