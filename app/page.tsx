import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Receipt, Check } from "lucide-react";
import { getSession } from "@/lib/session";
import { ANNUAL_PRICE_INR, TRIAL_LENGTH_DAYS } from "@/lib/subscription";
import SiteHeader from "@/components/marketing/SiteHeader";

const SECONDARY_FEATURES: { title: string; description: string }[] = [
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

function ProductShot({
  src,
  alt,
  width = 1440,
  height = 900,
  className = "",
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl shadow-card ring-1 ring-beige-300 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl ${className}`}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="h-auto w-full"
        sizes="(min-width: 1024px) 640px, 100vw"
      />
    </div>
  );
}

/** A numbered eyebrow label instead of the icon-in-a-rounded-square badge
 * motif — gives each section its own position in a sequence instead of an
 * interchangeable card in a grid. */
function Eyebrow({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
      <span className="text-brown-400/50">{index}</span>
      <span className="h-px w-6 bg-gold-500" />
      <span>{label}</span>
    </div>
  );
}

/** Decorative hero linework — concentric rings and a crosshair, reading as
 * a laser's targeting reticle rather than the soft gradient-blob glow this
 * replaced. Ties the hero back to what the clinic's machines actually do,
 * instead of a generic colorful wash. Purely linework (no fill), so it
 * reads as precise/technical rather than decorative-for-its-own-sake, and
 * stays legible at low opacity behind the product screenshot. Static — no
 * animation, on scroll or otherwise. */
function LaserMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 600 600"
      className="pointer-events-none absolute -right-24 -top-28 hidden h-[520px] w-[520px] text-gold-500/25 lg:block"
      fill="none"
    >
      <circle cx="300" cy="300" r="280" stroke="currentColor" strokeWidth="1" />
      <circle cx="300" cy="300" r="200" stroke="currentColor" strokeWidth="1" />
      <circle cx="300" cy="300" r="120" stroke="currentColor" strokeWidth="1" />
      <circle cx="300" cy="300" r="44" stroke="currentColor" strokeWidth="1.5" className="text-brown-900/15" />
      <line x1="300" y1="0" x2="300" y2="184" stroke="currentColor" strokeWidth="1" />
      <line x1="300" y1="416" x2="300" y2="600" stroke="currentColor" strokeWidth="1" />
      <line x1="0" y1="300" x2="184" y2="300" stroke="currentColor" strokeWidth="1" />
      <line x1="416" y1="300" x2="600" y2="300" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const trialMonths = Math.round(TRIAL_LENGTH_DAYS / 30);
  const trialLengthLabel = `${trialMonths} month${trialMonths === 1 ? "" : "s"}`;

  return (
    <div className="relative bg-canvas">
      <div className="relative z-10">
        <SiteHeader />

        {/* Hero — asymmetric split rather than centered-text-then-full-width-
            screenshot-below: the headline gets to be the widest thing on its
            own line instead of competing for center-stage width with a
            paragraph under it, and the screenshot reads as a product shot
            (offset, layered shadow, laser-reticle linework behind it) rather
            than a framed illustration floating on a gradient blob. The
            fade-up here plays once, on mount — not re-triggered per section
            on scroll. */}
        <section className="relative mx-auto max-w-7xl overflow-hidden px-6 pt-14 pb-20 sm:pt-20">
          <LaserMark />
          <div className="relative grid grid-cols-1 items-center gap-14 lg:grid-cols-[0.9fr_1.25fr] lg:gap-12">
            <div className="animate-fade-up" style={{ animationDelay: "0ms" }}>
              <h1 className="font-display text-[2.75rem] font-medium leading-[1.05] tracking-tight text-brown-900 sm:text-6xl">
                Run your laser &amp; aesthetics clinic without the spreadsheets.
              </h1>
              <p className="mt-6 max-w-md text-lg text-brown-600">
                One simple system for patients, appointments, billing, and everything else your
                clinic does every day.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  href="/signup"
                  className="rounded-md bg-brown-900 px-6 py-3 text-sm font-semibold text-beige-200 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-gold-600 hover:shadow-card active:scale-[0.97] active:duration-75"
                >
                  Start Your Free Trial
                </Link>
                <Link
                  href="/login"
                  className="rounded-md border border-beige-300 px-6 py-3 text-sm font-semibold text-brown-700 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-gold-500 hover:text-gold-600 active:scale-[0.97] active:duration-75"
                >
                  Log In
                </Link>
              </div>
              <p className="mt-5 text-sm text-brown-400">
                Free for {trialLengthLabel}. No credit card required to start.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-medium text-brown-600">
                <span className="rounded-full border border-beige-300 bg-surface px-3 py-1">
                  Data hosted in India
                </span>
                <span className="rounded-full border border-beige-300 bg-surface px-3 py-1">
                  DPDP Act 2023 compliant
                </span>
              </div>
            </div>

            <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
              <div className="relative lg:pl-6">
                <ProductShot
                  src="/screenshots/dashboard-today.png"
                  alt="Today's schedule, business snapshot, and revenue chart on the RadianceLaser dashboard"
                  className="shadow-2xl ring-brown-900/10 lg:rotate-[0.6deg]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* At-a-glance summary — sits directly on the canvas between two
            hairlines rather than inside another bordered white card, so the
            page doesn't read as "card, card, card" stacked top to bottom. */}
        <section className="mx-auto max-w-5xl px-6 pb-24">
          <div className="border-y border-beige-300 py-10">
            <div className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2">
              {[
                "Patients, appointments, packages, forms & receipts in one place",
                "Import your existing patient list from Excel or CSV",
                "Your data is private to your clinic, always",
                "Separate views for owners, doctors, and reception",
                "Revenue and staff numbers that update live, automatically",
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

        {/* Feature deep-dives, each with a real screenshot, alternating
            sides. Order: scheduling, analytics, forms (documents), patient
            view. */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-20">
          <Eyebrow index="02" label="What it does" />
          <h2 className="mt-4 max-w-lg font-display text-3xl font-medium leading-tight text-brown-900">
            Everything day-to-day clinic work needs
          </h2>

          <div className="mt-16 space-y-24">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
              <div>
                <h3 className="font-display text-xl font-medium text-brown-900">
                  Scheduling that already knows the patient
                </h3>
                <p className="mt-2 text-brown-600">
                  Day, week, and month views. Click a booking to see that patient&apos;s packages
                  and recent visits instantly — no need to look up their file separately.
                </p>
              </div>
              <ProductShot src="/screenshots/appointments-mini-panel.png" alt="Weekly appointment calendar with a patient's package and visit history open alongside it" />
            </div>

            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
              <div className="order-2 lg:order-1">
                <ProductShot src="/screenshots/analytics.png" alt="Revenue trend, treatment-type split, and most-treated areas on the RadianceLaser Analytics page" />
              </div>
              <div className="order-1 lg:order-2">
                <h3 className="font-display text-xl font-medium text-brown-900">
                  Know how the clinic is actually doing
                </h3>
                <p className="mt-2 text-brown-600">
                  See revenue by day, month, or year, and which treatments and staff bring in the
                  most. It updates automatically — there&apos;s no report to remember to run.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
              <div>
                <h3 className="font-display text-xl font-medium text-brown-900">
                  Consent forms and receipts, done right
                </h3>
                <p className="mt-2 text-brown-600">
                  Patients sign consent forms right on screen. Receipts get clean, sequential
                  numbers automatically, even when two staff issue them at once.
                </p>
              </div>
              <ProductShot src="/screenshots/documents-receipts.png" alt="Patient receipts list in RadianceLaser Documents" />
            </div>

            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
              <div className="order-2 lg:order-1">
                <ProductShot src="/screenshots/patient-detail.png" alt="A patient's full record and visit history in RadianceLaser" />
              </div>
              <div className="order-1 lg:order-2">
                <h3 className="font-display text-xl font-medium text-brown-900">
                  A full record for every patient
                </h3>
                <p className="mt-2 text-brown-600">
                  Skin type, contraindications, and every past visit on one page — for Q-Switch,
                  laser hair removal, or any machine your clinic uses.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Data import — text and image share a flex container so the image
            centers against the FULL text block (heading + paragraph +
            list), not just whichever line happens to be tallest. */}
        <section id="import" className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <div className="flex flex-col justify-center">
              <Eyebrow index="03" label="Switching over" />
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

        {/* Smaller, still-real features — a plain three-column list with
            hairline top rules instead of three more icon-badge cards. */}
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid grid-cols-1 gap-10 border-t border-beige-300 pt-10 sm:grid-cols-3 sm:gap-8">
            {SECONDARY_FEATURES.map(({ title, description }) => (
              <div key={title}>
                <h4 className="font-display text-lg font-medium text-brown-900">{title}</h4>
                <p className="mt-2 text-sm text-brown-600">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing — a single-plan "pricing column" card rather than a bare
            price line, since one raised, shadowed card reads as more
            deliberate than a plain announcement, even with just one plan
            to show. */}
        <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <h2 className="font-display text-2xl font-medium text-brown-900 sm:text-3xl">
              Simple, flat pricing
            </h2>
            <p className="mt-3 text-brown-600">One plan, everything included. No tiers to compare.</p>
          </div>

          <div className="relative mx-auto max-w-sm rounded-2xl bg-brown-900 p-8 text-beige-200 shadow-2xl ring-1 ring-brown-900/10 transition-transform duration-300 hover:-translate-y-1.5 sm:p-10">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gold-600 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-card">
              Everything included
            </div>

            <div className="flex items-center justify-center gap-2 text-sm uppercase tracking-wide text-gold-500">
              <Receipt size={16} />
              <span>Annual plan</span>
            </div>
            <div className="mt-4 text-center font-display text-5xl font-medium text-white">
              ₹{ANNUAL_PRICE_INR.toLocaleString("en-IN")}
              <span className="text-lg font-normal text-beige-200">/year</span>
            </div>
            <p className="mt-2 text-center text-sm text-beige-200">
              One clinic, unlimited staff accounts — no per-seat charges, no add-on tiers.
            </p>

            <div className="my-6 h-px bg-beige-200/15" />

            <ul className="space-y-3">
              {[
                "Unlimited staff accounts, every role included",
                "Patients, scheduling, packages, consent forms & receipts",
                "Import your existing patient list and session history",
                "Revenue, staff, and machine-usage analytics",
                "Per-clinic data isolation, enforced at the database",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-sm text-beige-200">
                  <Check size={18} className="mt-0.5 flex-shrink-0 text-gold-500" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              className="mt-8 block rounded-md bg-gold-600 px-6 py-3 text-center text-sm font-semibold text-white transition-all duration-150 ease-out hover:-translate-y-0.5 hover:bg-gold-500 hover:shadow-card active:scale-[0.97] active:duration-75"
            >
              Start Your Free Trial
            </Link>
            <p className="mt-3 text-center text-xs text-beige-200/80">
              Free for {trialLengthLabel} first — no credit card needed to start.
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-beige-300 py-8 text-center text-sm text-brown-400">
          <p>© {new Date().getFullYear()} RadianceLaser</p>
          <p className="mt-1 text-xs">Data hosted in India · Built to the DPDP Act 2023&apos;s standard</p>
        </footer>
      </div>
    </div>
  );
}
