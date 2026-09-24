import type { ReactNode } from "react";

/** Shared page gutter: 1200px of content on a 1440 canvas, tighter on
 * smaller screens. */
export function Wrap({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-12 xl:px-16 min-[1400px]:px-[120px] ${className}`}>{children}</div>
  );
}

/** The small mono section label ("SECURITY", "MESSAGING", ...). */
export function Eyebrow({ children, className = "text-lumi-accent" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-landing-mono text-xs uppercase tracking-[0.12em] ${className}`}>{children}</span>
  );
}

export const H2_CLASS =
  "text-[32px] font-medium leading-[1.05] tracking-[-0.04em] sm:text-5xl lg:text-[60px] lg:leading-[1.02]";

export function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className={className}>
      <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true" className={className}>
      <circle cx="15" cy="15" r="13.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="15" cy="15" r="5" className="fill-lumi-accent" />
      <path d="M15 1.5V6M15 24v4.5M1.5 15H6M24 15h4.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
