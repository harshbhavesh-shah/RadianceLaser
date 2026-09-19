import Image from "next/image";
import Link from "next/link";

/** The hero headline, CTA, and a real screenshot of the Analytics
 * dashboard below it, taken from the Lumière Aesthétique demo clinic
 * (see scripts/seedDemoClinic.mjs) rather than a CSS mockup, so the hero
 * shows the actual product instead of a placeholder. The reference
 * forces a break between the two sentences with a hard <br>, which reads
 * fine on its own desktop-only preview but wraps to three lines on a
 * real phone (the second sentence alone is still too wide at any font
 * size that doesn't make the whole hero feel tiny), pushing the CTA
 * further down the page than it needs to be. text-balance plus a
 * smaller mobile size lets the browser pick a more even two-line split
 * itself instead, so both lines end up a similar length at every width
 * rather than one short line and one long one. */
export default function LandingHero({ trialLengthLabel }: { trialLengthLabel: string }) {
  return (
    <div className="flex flex-col items-center px-6 pt-16 text-center md:pt-24">
      <h1 className="max-w-[900px] text-balance text-[26px] font-extrabold leading-[1.15] tracking-tight text-brown-900 sm:text-5xl md:text-6xl md:leading-[1.1] lg:text-[72px]">
        Built for laser clinics. Not bent into shape for them.
      </h1>
      <p className="mt-6 max-w-2xl text-lg font-medium leading-relaxed text-brown-400 md:text-xl">
        Scheduling, patient records, WhatsApp automation, and compliance. One system that already
        understands how a laser clinic runs.
      </p>

      <div className="mt-10 flex flex-col items-center gap-4">
        <Link
          href="/signup"
          className="rounded-[18px] bg-rust-600 px-8 py-4 text-lg font-extrabold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-rust-700 hover:shadow-lg"
        >
          Start Free Trial
        </Link>
        <p className="text-sm font-semibold text-brown-400">
          Free for {trialLengthLabel} &middot; No credit card required &middot; Data hosted in India
        </p>
      </div>

      {/* Real screenshot of the dashboard people see right after logging
          in ("Today at a glance"), from the Lumière Aesthétique demo
          clinic. */}
      <div className="mb-24 mt-20 w-full max-w-[1200px] px-4 md:mt-28">
        <div className="mx-auto rounded-[24px] border border-beige-300 bg-white/40 p-2 shadow-2xl backdrop-blur-sm md:p-3">
          <div className="relative overflow-hidden rounded-[18px] border border-beige-300 shadow-soft">
            <Image
              src="/hero-screenshot.png"
              alt="Radiance Laser dashboard showing today's schedule, appointments, revenue, and weekly performance"
              width={1440}
              height={960}
              className="w-full"
              // Without this, the browser has no way to know the image
              // never actually renders wider than the 1200px container
              // (className="w-full" makes the CSS width responsive, fully
              // decoupled from the 1440 intrinsic width above) and falls
              // back to picking a srcset candidate sized for the full
              // intrinsic width — on a real phone that means downloading
              // and decoding a needlessly large image for the page's own
              // LCP element. This is the single biggest lever on mobile
              // LCP/TTI for this page.
              sizes="(min-width: 1200px) 1200px, 100vw"
              priority
            />
          </div>
        </div>
      </div>
    </div>
  );
}
