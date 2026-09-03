import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Receipt, Check } from "lucide-react";
import { getSession } from "@/lib/session";
import { ANNUAL_PRICE_INR, TRIAL_LENGTH_DAYS } from "@/lib/subscription";
import SiteHeader from "@/components/marketing/SiteHeader";

// Everything that doesn't earn its own showcase block below — each one
// still real, just not the differentiator the automation section is.
const ALL_FEATURES: { title: string; description: string }[] = [
  {
    title: "Scheduling",
    description:
      "Day, week, and month views. Click a booking to see that patient's packages and recent visits instantly.",
  },
  {
    title: "Revenue & Analytics",
    description:
      "Revenue by day, month, or year, and which treatments and staff bring in the most — updates automatically.",
  },
  {
    title: "Consent Forms & Receipts",
    description:
      "Patients sign on screen. Receipts get clean, sequential numbers automatically, even with two staff issuing at once.",
  },
  {
    title: "Patient Records",
    description: "Skin type, contraindications, and every past visit on one page, for any machine your clinic uses.",
  },
  {
    title: "Prepaid Packages",
    description: "Sell session bundles and always see exactly how many sessions are left.",
  },
  {
    title: "Before/After Photos",
    description: "Track each patient's progress, with sensitive photos blurred until you tap to view them.",
  },
  {
    title: "No Duplicate Patients",
    description: "We check phone numbers automatically, so the same patient never ends up with two records.",
  },
];

// Ordered so the two claims a clinic owner in India cares about most —
// where the data physically sits, and whether the software itself meets
// the DPDP Act's obligations — come before the more generic app-security
// points. Written after an actual line-by-line compliance review (see
// docs/incident-response-runbook.md and the AuditLog/erasure work it
// describes), not aspirational copy.
const SECURITY_POINTS: { title: string; description: string }[] = [
  {
    title: "Hosted in India, by design",
    description: "Your database runs in Mumbai. Patient data is never routed through, or stored in, another country.",
  },
  {
    title: "Built to the DPDP Act's standard",
    description:
      "Every patient consents at intake, and can request their record be corrected or permanently erased — exactly what India's Digital Personal Data Protection Act requires.",
  },
  {
    title: "Your data, only your clinic",
    description:
      "Every request is checked against your clinic before anything loads — even a shared link from another clinic won't open your records.",
  },
  {
    title: "Role-based access, logged",
    description: "Owners, doctors, and reception each see only what they need. Sensitive changes record who made them, and when.",
  },
  {
    title: "Private by default",
    description:
      "Sensitive photos stay blurred until you choose to view them, and a signed consent form can never be quietly changed afterward.",
  },
];

const PLAN_FEATURES = [
  "Unlimited staff accounts, every role included",
  "Patients, scheduling, packages, consent forms & receipts",
  "Automated WhatsApp reminders, feedback & no-show recovery",
  "Import your existing patient list and session history",
  "Revenue, staff, and machine-usage analytics",
  "Per-clinic data isolation, enforced at the database",
];

function ProductShot({
  src,
  alt,
  width = 1440,
  height = 900,
  className = "",
  sizes = "(min-width: 1024px) 640px, 100vw",
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl shadow-card ring-1 ring-beige-300 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl ${className}`}
    >
      <Image src={src} alt={alt} width={width} height={height} className="h-auto w-full" sizes={sizes} />
    </div>
  );
}

/** A numbered eyebrow label instead of the icon-in-a-rounded-square badge
 * motif — gives each section its own position in a sequence instead of an
 * interchangeable card in a grid. `dark` swaps to the light-on-dark
 * palette for use on the hero/pricing backdrops. */
function Eyebrow({ index, label, dark = false }: { index: string; label: string; dark?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] ${dark ? "text-gold-400" : "text-gold-600"}`}
    >
      <span className={dark ? "text-white/30" : "text-brown-400/50"}>{index}</span>
      <span className="h-px w-6 bg-gold-500" />
      <span>{label}</span>
    </div>
  );
}

const HERO_SHOT_SIZES = "(min-width: 1024px) 58vw, 100vw";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const trialMonths = Math.round(TRIAL_LENGTH_DAYS / 30);
  const trialLengthLabel = `${trialMonths} month${trialMonths === 1 ? "" : "s"}`;

  return (
    <div className="relative">
      {/* The hero's dark ground — sized generously (rather than precisely)
          to outlast the hero's actual rendered height at every breakpoint,
          since a plain CSS height guess can't track variable text/image
          height exactly, and white hero text landing outside it would be
          unreadable. Erring tall is free: the canvas-backed wrapper right
          after the hero is opaque and painted in normal flow, so any
          backdrop that runs past the hero's real bottom edge just gets
          covered, never the other way around. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[1500px] bg-gradient-to-b from-brown-800 to-brown-900 sm:h-[1300px] md:h-[1050px] lg:h-[820px]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_1000px_600px_at_78%_18%,rgba(169,129,47,0.22),transparent_65%)]" />
      </div>

      <div className="relative z-10">
        <SiteHeader />

        {/* Hero — asymmetric split, headline gets to be the widest thing on
            its own line instead of competing for center-stage width with a
            paragraph under it. One flat, unrotated screenshot rather than a
            tilted stack of two — a straight-on shot reads as the real
            product; a tilted, layered pair reads as hero-graphic decoration.
            Container is wider than the rest of the page's sections (1600px
            vs the usual ~1280px) so the hero actually uses the available
            width on a wide monitor instead of leaving dead margins either
            side. */}
        <section className="relative mx-auto max-w-[1600px] px-6 pt-14 pb-20 sm:pt-20 lg:px-12">
          <div className="relative grid grid-cols-1 items-center gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div className="animate-fade-up" style={{ animationDelay: "0ms" }}>
              <h1 className="font-display text-[2.5rem] font-medium leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">
                Run your laser &amp; aesthetics clinic without the spreadsheets.
              </h1>
              <p className="mt-6 max-w-md text-lg text-beige-300">
                One simple system for patients, appointments, billing, and everything else your
                clinic does every day.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  href="/signup"
                  className="rounded-md bg-gold-500 px-6 py-3 text-sm font-semibold text-brown-900 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-gold-400 hover:shadow-card active:scale-[0.97] active:duration-75"
                >
                  Start Your Free Trial
                </Link>
                <Link
                  href="/login"
                  className="rounded-md border border-white/20 px-6 py-3 text-sm font-semibold text-beige-100 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-gold-400 hover:text-gold-400 active:scale-[0.97] active:duration-75"
                >
                  Log In
                </Link>
              </div>
              <p className="mt-5 text-sm text-beige-300/70">
                Free for {trialLengthLabel}. No credit card required to start.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-beige-300">
                <Link
                  href="/compliance"
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 transition-colors hover:border-gold-400 hover:text-gold-400"
                >
                  Data hosted in India
                </Link>
                <Link
                  href="/compliance"
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 transition-colors hover:border-gold-400 hover:text-gold-400"
                >
                  DPDP Act 2023 compliant
                </Link>
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
                  Udyam Registered
                </span>
              </div>
            </div>

            <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
              <ProductShot
                src="/screenshots/dashboard-today.png"
                alt="Today's schedule, business snapshot, and revenue chart on the RadianceLaser dashboard"
                className="shadow-2xl ring-white/10"
                sizes={HERO_SHOT_SIZES}
              />
            </div>
          </div>
        </section>
      </div>

      {/* Everything below the hero sits on its own bg-canvas wrapper — it's
          what covers the dark backdrop's tail end below where the hero's
          own content runs shorter than the backdrop's generous heights. */}
      <div className="relative z-10 bg-canvas">
        {/* At-a-glance summary — sits directly on the canvas between two
            hairlines rather than inside another bordered white card, so the
            page doesn't read as "card, card, card" stacked top to bottom. */}
        <section className="mx-auto max-w-5xl px-6 pb-24 pt-16">
          <div className="border-y border-beige-300 py-10">
            <div className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
              {[
                "Patients, appointments, packages, forms & receipts in one place",
                "WhatsApp reminders, feedback surveys, and no-show recovery, automatic",
                "Import your existing patient list from Excel or CSV",
                "Your data is private to your clinic, always",
                "Separate views for owners, doctors, and reception",
                "One flat yearly price — unlimited staff, no hidden fees",
              ].map((line) => (
                <div key={line} className="flex items-start gap-2.5 text-sm text-brown-700">
                  <Check size={18} className="mt-0.5 flex-shrink-0 text-gold-600" />
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Data privacy & security — a numbered, rule-divided list instead
            of icon-badge cards in a grid. Deliberately doesn't claim any
            compliance certification (HIPAA, SOC 2, etc.) that hasn't
            actually been obtained — real architecture, described
            honestly, checked against India's actual data-protection law
            rather than a generic "we take security seriously" list. */}
        <section id="security" className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,280px)_1fr]">
            <div>
              <Eyebrow index="01" label="Data & Security" />
              <h2 className="mt-4 font-display text-3xl font-medium leading-tight text-brown-900">
                Built for Indian clinics, compliant by design
              </h2>
              <p className="mt-3 text-brown-600">
                Patient records are sensitive, and India has specific rules for how they're
                handled. Here&apos;s how we actually meet them.
              </p>
            </div>

            <div className="divide-y divide-beige-300 border-t border-beige-300 lg:border-t-0">
              {SECURITY_POINTS.map(({ title, description }, i) => (
                <div key={title} className="grid grid-cols-1 gap-2 py-6 sm:grid-cols-[3rem_1fr] sm:gap-6">
                  <span className="font-display text-2xl text-brown-300">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-medium text-brown-900">{title}</h3>
                    <p className="mt-1.5 text-sm text-brown-600">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Automated Messaging — the one flagship showcase, given real
            visual weight instead of being one more alternating 50/50 block
            among six identical ones. Two real screenshots collaged rather
            than one, so it reads as "here are two things this does," not
            hero-graphic decoration. This is the newest, most competitive
            piece of the product (see the reminders/no-show work), so it
            gets to be the biggest thing on the page after the hero. */}
        <section id="features" className="bg-beige-100">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <Eyebrow index="02" label="Automated Messaging" />
            <div className="mt-12 grid grid-cols-1 items-center gap-14 lg:grid-cols-[0.85fr_1.15fr]">
              <div>
                <h2 className="font-display text-3xl font-medium leading-tight text-brown-900 sm:text-4xl">
                  Reminders, feedback, and no-show recovery — all automatic
                </h2>
                <p className="mt-4 text-brown-600">
                  A WhatsApp reminder goes out before every appointment, and a short satisfaction
                  survey after every visit. When someone misses one, your own follow-up — a reason
                  survey, a win-back offer, a reschedule nudge — sends itself. All over your own
                  WhatsApp number, all without anyone at the front desk remembering to hit send.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-brown-700">
                  <li className="flex items-start gap-2.5">
                    <Check size={18} className="mt-0.5 flex-shrink-0 text-gold-600" />
                    <span>Reminders and surveys sent automatically, no staff time spent</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={18} className="mt-0.5 flex-shrink-0 text-gold-600" />
                    <span>No-show trends by week and month, so you know if it's getting worse</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check size={18} className="mt-0.5 flex-shrink-0 text-gold-600" />
                    <span>Configurable follow-ups — survey, incentive, or reminder — on or off per clinic</span>
                  </li>
                </ul>
              </div>

              <div className="relative">
                <ProductShot
                  src="/screenshots/communication-automation.png"
                  alt="Automated appointment reminders and post-visit feedback survey results on the RadianceLaser Communication page"
                  sizes="(min-width: 1024px) 46vw, 100vw"
                />
                <div className="absolute -bottom-10 -left-10 hidden w-[58%] overflow-hidden rounded-xl shadow-2xl ring-4 ring-beige-100 lg:block">
                  <Image
                    src="/screenshots/no-shows-followups.png"
                    alt="Configurable no-show follow-ups and recent no-shows list on the RadianceLaser No Shows page"
                    width={1440}
                    height={500}
                    className="h-auto w-full"
                    sizes="27vw"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Everything else clinic work needs — a dense, text-only grid
            rather than more full-width alternating screenshot blocks.
            Deliberately plain: the automation section above is the one
            thing on this page that gets the oversized-screenshot
            treatment, so this staying compact and scannable is the point,
            not a shortcut. */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <Eyebrow index="03" label="Everything else" />
          <h2 className="mt-4 max-w-lg font-display text-3xl font-medium leading-tight text-brown-900">
            Plus everything else day-to-day clinic work needs
          </h2>

          <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-10 border-t border-beige-300 pt-10 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_FEATURES.map(({ title, description }) => (
              <div key={title}>
                <h3 className="font-display text-lg font-medium text-brown-900">{title}</h3>
                <p className="mt-2 text-sm text-brown-600">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Data import — text and image share a flex container so the image
            centers against the FULL text block (heading + paragraph +
            list), not just whichever line happens to be tallest. */}
        <section id="import" className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <div className="flex flex-col justify-center">
              <Eyebrow index="04" label="Switching over" />
              <h2 className="mt-4 font-display text-3xl font-medium leading-tight text-brown-900">
                Switch to Radiance in an afternoon
              </h2>
              <p className="mt-3 text-brown-600">
                Already tracking patients in Excel or a notebook? You don&apos;t have to start
                over — bring in your patient list and session history from a spreadsheet in a few
                clicks.
              </p>
              <ul className="mt-5 space-y-3 text-sm text-brown-700">
                <li className="flex items-start gap-2.5">
                  <Check size={18} className="mt-0.5 flex-shrink-0 text-gold-600" />
                  <span>Patients and their session history, matched so nobody gets duplicated</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={18} className="mt-0.5 flex-shrink-0 text-gold-600" />
                  <span>Preview what&apos;s coming in before you confirm anything</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={18} className="mt-0.5 flex-shrink-0 text-gold-600" />
                  <span>Skip or replace anything that looks like a duplicate</span>
                </li>
              </ul>
            </div>
            <div className="flex items-center">
              <ProductShot src="/screenshots/settings-import.png" alt="Import Patients and Import Session History sections in RadianceLaser Settings" />
            </div>
          </div>
        </section>

        {/* Pricing — a wide dark band rather than a small centered card,
            deliberately echoing the hero's backdrop so the page opens and
            closes on the same dark-brown/gold register instead of ending
            on one more white section. Price and feature list sit side by
            side instead of stacked in a narrow column, since there's a
            full-width band to use instead of a card's fixed width. */}
        <section id="pricing" className="relative overflow-hidden bg-gradient-to-b from-brown-800 to-brown-900 py-24">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_900px_500px_at_15%_15%,rgba(169,129,47,0.18),transparent_65%)]"
          />
          <div className="relative mx-auto max-w-5xl px-6">
            <Eyebrow index="05" label="Pricing" dark />
            <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <div className="flex items-center gap-2 text-sm uppercase tracking-wide text-gold-400">
                  <Receipt size={16} />
                  <span>Annual plan</span>
                </div>
                <div className="mt-4 font-display text-6xl font-medium text-white">
                  ₹{ANNUAL_PRICE_INR.toLocaleString("en-IN")}
                  <span className="text-lg font-normal text-beige-200">/year</span>
                </div>
                <p className="mt-3 max-w-xs text-sm text-beige-200">
                  One clinic, unlimited staff accounts — no per-seat charges, no add-on tiers.
                </p>
                <Link
                  href="/signup"
                  className="mt-8 inline-block rounded-md bg-gold-500 px-6 py-3 text-sm font-semibold text-brown-900 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-gold-400 hover:shadow-card active:scale-[0.97] active:duration-75"
                >
                  Start Your Free Trial
                </Link>
                <p className="mt-3 text-xs text-beige-200/70">
                  Free for {trialLengthLabel} first — no credit card needed to start.
                </p>
              </div>

              <div className="border-t border-white/10 pt-8 lg:border-t-0 lg:border-l lg:pl-12 lg:pt-0">
                <ul className="space-y-3">
                  {PLAN_FEATURES.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-sm text-beige-200">
                      <Check size={18} className="mt-0.5 flex-shrink-0 text-gold-400" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-beige-300 py-8 text-center text-sm text-brown-400">
          <p>© {new Date().getFullYear()} RadianceLaser</p>
          <p className="mt-1 text-xs">
            <Link href="/compliance" className="underline decoration-beige-300 underline-offset-2 hover:text-gold-600">
              Data hosted in India · DPDP Act 2023 compliant
            </Link>
          </p>
          <p className="mt-1 text-xs">
            Udyam Registered: UDYAM-GJ-20-0310289 · Medical Advisor: Dr. Bhavesh Shah
          </p>
        </footer>
      </div>
    </div>
  );
}
