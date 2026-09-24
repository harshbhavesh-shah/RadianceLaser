import Image from "next/image";
import Link from "next/link";
import { ArrowIcon } from "./ui";

// Faint 64px graph-paper grid behind the hero.
const GRID_BACKGROUND = {
  backgroundImage:
    "linear-gradient(rgba(23,20,15,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(23,20,15,0.05) 1px, transparent 1px)",
  backgroundSize: "64px 64px",
} as const;

/** Two-column hero: headline and calls to action on the left, a laptop and a
 * phone screenshot on the right. Both screenshots are live captures of the
 * populated "Today at a glance" page from the Lumière Aesthétique demo clinic
 * (see scripts/seedDemoClinic.mjs and scripts/topUpTodayDemo.mjs), not
 * mockups. Below xl the columns stack and the phone overlaps the laptop's
 * bottom-left corner; at xl the laptop deliberately bleeds off the right edge
 * (it is sized to the space left of the text, plus the bleed, and capped at
 * the design's 880px).
 *
 * The headline's font size is derived from the viewport below xl (its longest
 * line is ~12.4em wide and each breakpoint has its own page gutter), so both
 * sentences stay on one line each at any width, capped at the design's 66px.
 * At xl it sits in a 540px column and wraps naturally. */
export default function LandingHero({ trialLengthLabel }: { trialLengthLabel: string }) {
  return (
    <section id="top" className="relative scroll-mt-24 overflow-hidden bg-lumi-paper" style={GRID_BACKGROUND}>
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-14 px-5 pb-16 pt-12 sm:px-8 md:pb-20 md:pt-16 xl:h-[820px] xl:flex-row xl:items-center xl:gap-16 xl:py-0 xl:pl-16 xl:pr-0 min-[1400px]:pl-[120px]">
        <div className="relative flex flex-col gap-6 xl:w-[540px] xl:shrink-0 xl:gap-7">
          <div className="flex h-8 items-center gap-2.5 self-start rounded-full border border-lumi-ink/[0.12] bg-lumi-card px-3.5 font-landing-mono text-[11px] tracking-[0.1em] text-lumi-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-lumi-accent" />
            FOR LASER &amp; AESTHETIC CLINICS
          </div>

          <h1 className="text-balance text-[length:min(30px,calc((100vw-40px)/12.6))] font-medium leading-[1.04] tracking-[-0.045em] sm:text-[length:min(66px,calc((100vw-64px)/12.6))] xl:text-[66px] xl:leading-[1.02]">
            Built for laser clinics.
            <br className="xl:hidden" /> Not bent into shape for them.
          </h1>

          <p className="max-w-[560px] text-base leading-relaxed text-lumi-soft sm:text-lg xl:text-[19px] xl:leading-[1.55]">
            Scheduling, patient records, WhatsApp automation, and compliance. One system that already understands how a
            laser clinic runs.
          </p>

          <div className="mt-1 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="flex h-14 items-center justify-center gap-3 rounded-full bg-lumi-accent px-7 text-base font-medium text-white transition-colors hover:bg-lumi-accent-dark"
            >
              Start free trial
              <ArrowIcon />
            </Link>
            <a
              href="#how-it-works"
              className="flex h-14 items-center justify-center rounded-full border border-lumi-ink/25 bg-lumi-card px-6 text-base font-medium transition-colors hover:border-lumi-ink"
            >
              See how it works
            </a>
          </div>

          <p className="font-landing-mono text-xs tracking-[0.04em] text-lumi-mute">
            Free for {trialLengthLabel} · No credit card required · Data hosted in India
          </p>
        </div>

        <div className="relative pb-8 xl:min-h-full xl:flex-grow xl:self-stretch xl:pb-0">
          <div
            id="product"
            className="w-full max-w-[880px] scroll-mt-24 overflow-hidden rounded-2xl border border-lumi-ink/[0.14] bg-lumi-card shadow-[0_60px_100px_-50px_rgba(90,40,15,0.45)] xl:absolute xl:left-10 xl:top-[110px] xl:w-[min(880px,calc(100%+164px))] xl:max-w-none"
          >
            <div className="flex h-10 items-center gap-2 border-b border-lumi-ink/10 bg-[#EFE9DE] px-4">
              <span className="h-2.5 w-2.5 rounded-full bg-[#D5CCBD]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#D5CCBD]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#D5CCBD]" />
              <div className="ml-4 flex flex-grow justify-center">
                <div className="flex h-6 items-center gap-2 rounded-md bg-lumi-card px-3.5 font-landing-mono text-[11px] text-lumi-mute">
                  <svg width="10" height="12" viewBox="0 0 10 12" fill="none" aria-hidden="true">
                    <rect x="1" y="5" width="8" height="6" rx="1" stroke="currentColor" />
                    <path d="M3 5V3.5a2 2 0 014 0V5" stroke="currentColor" />
                  </svg>
                  lumiereradiance.in
                </div>
              </div>
              <span className="hidden w-[46px] sm:block" />
            </div>
            <Image
              src="/hero-dashboard-laptop.png"
              alt="Lumière by Radiance dashboard on a laptop: today's schedule with completed and booked appointments, revenue for the day, and weekly performance"
              width={1760}
              height={1120}
              className="block w-full"
              // Rendered at most 880px wide; without sizes the browser would
              // pick a candidate for the full intrinsic width, which on a
              // phone is a needlessly large download for the LCP element.
              sizes="(min-width: 920px) 880px, 100vw"
              priority
            />
          </div>

          <div className="absolute bottom-0 left-2 w-[104px] rounded-[20px] bg-lumi-ink p-1.5 shadow-[0_40px_70px_-30px_rgba(60,30,10,0.55)] sm:left-4 sm:w-[150px] sm:rounded-[26px] sm:p-2 md:w-[180px] xl:bottom-auto xl:left-0 xl:top-[320px] xl:w-[220px] xl:rounded-[30px]">
            <Image
              src="/hero-dashboard-phone.png"
              alt="Lumière by Radiance dashboard on a phone showing today's appointments and revenue"
              width={612}
              height={1302}
              className="block w-full rounded-[14px] sm:rounded-[19px] xl:rounded-[23px]"
              sizes="(min-width: 1280px) 204px, (min-width: 768px) 170px, 100px"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
