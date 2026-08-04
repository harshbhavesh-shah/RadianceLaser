import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Users,
  Sparkles,
  Calendar,
  Package,
  FileSignature,
  BarChart3,
  Receipt,
  Image as ImageIcon,
  FileSpreadsheet,
  ShieldCheck,
  Lock,
  Eye,
  KeyRound,
  Check,
} from "lucide-react";
import { getSession } from "@/lib/session";
import { ANNUAL_PRICE_INR, TRIAL_LENGTH_DAYS } from "@/lib/subscription";
import Reveal from "@/components/marketing/Reveal";

const SECONDARY_FEATURES: { icon: typeof Users; title: string; description: string }[] = [
  {
    icon: Package,
    title: "Prepaid Packages",
    description:
      "Sell session bundles with a usage ledger computed live from actual visits — never a stored number that can drift out of sync with what actually happened.",
  },
  {
    icon: ImageIcon,
    title: "Before/After Photo Galleries",
    description:
      "Track progress per patient, with a sensitive-content blur toggle for anyone glancing at a screen who shouldn't see it.",
  },
  {
    icon: Users,
    title: "Duplicate-Safe Patient Records",
    description:
      "Skin type, contraindications, and full visit history in one place — with duplicate-phone detection so the same patient never quietly gets a second record.",
  },
];

const SECURITY_POINTS: { icon: typeof ShieldCheck; title: string; description: string }[] = [
  {
    icon: ShieldCheck,
    title: "Isolation enforced at the database, not just the app",
    description:
      "Every clinic's data carries a clinic ID, and Firestore's own security rules — not application code you have to trust — reject any read or write where that ID doesn't match the signed-in staff member's own clinic. Even a leaked document link from another clinic is unreadable.",
  },
  {
    icon: KeyRound,
    title: "Secure session handling",
    description:
      "Sign-in tokens are never stored in a cookie a script could read — sessions are HttpOnly, verified server-side on every request, and separate from the lightweight check that just redirects signed-out visitors away from the dashboard.",
  },
  {
    icon: Lock,
    title: "Role-based access",
    description:
      "Owner, doctor, and reception accounts see different things — billing and staff management stay owner-only, for example — enforced on both the page and the underlying data request.",
  },
  {
    icon: Eye,
    title: "Sensitive content stays hidden until asked for",
    description:
      "Photos marked sensitive stay blurred in the gallery grid until someone deliberately clicks to reveal them, and signed consent forms are frozen at the moment of signing, so editing a template later can never rewrite what a patient actually agreed to.",
  },
];

function ProductShot({
  src,
  alt,
  width = 1440,
  height = 900,
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl shadow-card ring-1 ring-beige-300 transition-transform duration-300 hover:-translate-y-1">
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

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const trialMonths = Math.round(TRIAL_LENGTH_DAYS / 30);

  return (
    <div className="relative overflow-hidden bg-canvas">
      {/* Same decorative glow treatment as /login and /signup — one visual
          identity from the first thing a visitor sees through to the
          product itself. Fades in on first paint (animate-glow-in) rather
          than just appearing at full opacity. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[440px] overflow-hidden animate-spotlight-wipe">
        <div
          className="animate-glow-in absolute left-1/2 top-[-200px] h-[420px] w-[420px] rounded-full bg-gold-100 blur-3xl"
          style={{ animationDelay: "0s", marginLeft: "-357px" }}
        />
        <div
          className="animate-glow-in absolute left-1/2 top-[-160px] h-[380px] w-[380px] rounded-full bg-rose-200/70 blur-3xl"
          style={{ animationDelay: "-5s", marginLeft: "-38px" }}
        />
        <div
          className="animate-glow-in absolute left-1/2 top-[-220px] h-[440px] w-[440px] rounded-full bg-violet-200/60 blur-3xl"
          style={{ animationDelay: "-10s", marginLeft: "88px" }}
        />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 sm:py-6">
          <span className="font-display text-lg font-medium text-brown-900 sm:text-xl">RadianceLaser</span>
          <nav className="hidden items-center gap-6 text-sm font-medium text-brown-600 md:flex">
            <a href="#security" className="hover:text-gold-600">
              Data &amp; Security
            </a>
            <a href="#features" className="hover:text-gold-600">
              Features
            </a>
            <a href="#import" className="hover:text-gold-600">
              Switch from your old system
            </a>
            <a href="#pricing" className="hover:text-gold-600">
              Pricing
            </a>
          </nav>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/login"
              className="whitespace-nowrap text-xs font-medium text-brown-700 hover:text-gold-600 sm:text-sm"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="whitespace-nowrap rounded-md bg-brown-900 px-3 py-1.5 text-xs font-semibold text-beige-200 transition-colors hover:bg-gold-600 sm:px-4 sm:py-2 sm:text-sm"
            >
              <span className="sm:hidden">Start Trial</span>
              <span className="hidden sm:inline">Start Free Trial</span>
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 pt-16 pb-8 text-center">
          <Reveal>
            <h1 className="font-display text-4xl font-medium leading-tight text-brown-900 sm:text-5xl">
              The one place to run your laser &amp; aesthetics clinic
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-brown-600">
              Patients, treatment sessions, appointments, prepaid packages, consent forms, receipts,
              and revenue — built specifically for laser and aesthetics clinics, not a generic
              practice-management tool with your industry bolted on.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/signup"
                className="rounded-md bg-brown-900 px-6 py-3 text-sm font-semibold text-beige-200 transition-all hover:-translate-y-0.5 hover:bg-gold-600 hover:shadow-card"
              >
                Start Your Free Trial
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-beige-300 px-6 py-3 text-sm font-semibold text-brown-700 transition-all hover:-translate-y-0.5 hover:border-gold-500 hover:text-gold-600"
              >
                Log In
              </Link>
            </div>
            <p className="mt-4 text-sm text-brown-400">
              Free for {trialMonths} months. No credit card required to start.
            </p>
          </Reveal>
        </section>

        {/* Hero screenshot — the whole day at a glance */}
        <section className="mx-auto max-w-5xl px-6 pb-20">
          <Reveal delayMs={150}>
            <ProductShot src="/screenshots/dashboard-today.png" alt="Today's schedule, business snapshot, and revenue chart on the RadianceLaser dashboard" />
            <p className="mt-3 text-center text-sm text-brown-400">
              Today&apos;s schedule, business snapshot, and revenue — the first thing you see, every
              morning.
            </p>
          </Reveal>
        </section>

        {/* At-a-glance summary strip — the "more information at a glance"
            request: a scannable list before anyone has to read prose. */}
        <section className="mx-auto max-w-4xl px-6 pb-20">
          <Reveal>
            <div className="grid grid-cols-1 gap-x-8 gap-y-3 rounded-xl bg-surface p-8 shadow-soft ring-1 ring-beige-300 sm:grid-cols-2">
              {[
                "Patients, visits, appointments, packages, consent forms & receipts — one system",
                "Import your existing patient list and session history from Excel/CSV",
                "Per-clinic data isolation enforced at the database level, not just in app code",
                "Role-based access for owners, doctors, and reception staff",
                "Revenue, staff, and machine-usage analytics, computed live — never stale exports",
                "Flat annual pricing, unlimited staff accounts, no per-seat fees",
              ].map((line) => (
                <div key={line} className="flex items-start gap-2.5 text-sm text-brown-700">
                  <Check size={18} className="mt-0.5 flex-shrink-0 text-gold-600" />
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* Data privacy & security — moved up front, ahead of the feature
            deep-dives. Real architecture, described honestly. Deliberately
            doesn't claim any compliance certification (HIPAA, SOC 2, etc.)
            that hasn't actually been obtained. */}
        <section id="security" className="mx-auto max-w-6xl px-6 py-16">
          <Reveal>
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-gold-100 text-gold-600">
                <ShieldCheck size={20} />
              </div>
              <h2 className="mt-4 font-display text-2xl font-medium text-brown-900 sm:text-3xl">
                Built with patient data privacy in mind
              </h2>
              <p className="mt-3 text-brown-600">
                Patient records are sensitive by nature. Here&apos;s specifically how they&apos;re
                protected — not a badge or a claim, the actual architecture.
              </p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {SECURITY_POINTS.map(({ icon: Icon, title, description }, i) => (
              <Reveal key={title} delayMs={i * 80}>
                <div className="h-full rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300 transition-shadow duration-300 hover:shadow-card">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-100 text-gold-600">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-medium text-brown-900">{title}</h3>
                  <p className="mt-2 text-sm text-brown-600">{description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Feature deep-dives, each with a real screenshot, alternating sides.
            Order: scheduling, analytics, forms (documents), patient view. */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-16">
          <Reveal>
            <div className="mx-auto mb-12 max-w-xl text-center">
              <h2 className="font-display text-2xl font-medium text-brown-900 sm:text-3xl">
                Everything day-to-day clinic work needs
              </h2>
              <div className="mx-auto mt-3 h-[2px] w-10 bg-gold-500" />
            </div>
          </Reveal>

          <div className="space-y-20">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
              <Reveal>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-100 text-gold-600">
                  <Calendar size={20} />
                </div>
                <h3 className="mt-4 font-display text-xl font-medium text-brown-900">
                  Scheduling that already knows the patient
                </h3>
                <p className="mt-2 text-brown-600">
                  Day, week, and month calendar views. Click any booking and see that patient&apos;s
                  active packages and recent visits right alongside it — no second screen, no
                  second app, no searching for their file.
                </p>
              </Reveal>
              <Reveal delayMs={120}>
                <ProductShot src="/screenshots/appointments-mini-panel.png" alt="Weekly appointment calendar with a patient's package and visit history open alongside it" />
              </Reveal>
            </div>

            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
              <Reveal className="order-2 lg:order-1">
                <ProductShot src="/screenshots/analytics.png" alt="Revenue trend, treatment-type split, and most-treated areas on the RadianceLaser Analytics page" />
              </Reveal>
              <Reveal delayMs={120} className="order-1 lg:order-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-100 text-gold-600">
                  <BarChart3 size={20} />
                </div>
                <h3 className="mt-4 font-display text-xl font-medium text-brown-900">
                  Know how the clinic is actually doing
                </h3>
                <p className="mt-2 text-brown-600">
                  Revenue by day, month, and year; a split between direct sessions and package
                  redemptions; which treatments, staff, and machines are actually earning — all
                  computed live from the same visits and receipts your team logs day to day, never
                  a separate report to remember to run.
                </p>
              </Reveal>
            </div>

            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
              <Reveal>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-100 text-gold-600">
                  <FileSignature size={20} />
                </div>
                <h3 className="mt-4 font-display text-xl font-medium text-brown-900">
                  Consent forms and receipts, done right
                </h3>
                <p className="mt-2 text-brown-600">
                  Clinic-branded consent templates, signed on-screen and frozen the moment
                  they&apos;re signed. Itemized receipts with sequential, gap-free numbering
                  allocated atomically, so two staff issuing receipts at the same moment can never
                  collide on the same number.
                </p>
              </Reveal>
              <Reveal delayMs={120}>
                <ProductShot src="/screenshots/documents-receipts.png" alt="Patient receipts list in RadianceLaser Documents" />
              </Reveal>
            </div>

            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
              <Reveal className="order-2 lg:order-1">
                <ProductShot src="/screenshots/patient-detail.png" alt="A patient's full record and visit history in RadianceLaser" />
              </Reveal>
              <Reveal delayMs={120} className="order-1 lg:order-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-100 text-gold-600">
                  <Users size={20} />
                </div>
                <h3 className="mt-4 font-display text-xl font-medium text-brown-900">
                  A full record for every patient
                </h3>
                <p className="mt-2 text-brown-600">
                  Skin type, contraindications, and every logged visit in one page — Q-Switch,
                  laser hair removal, or any custom machine type your clinic runs, each session
                  keeping its own tracked fields (area, energy, passes, fee, and more).
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Data import — a named selling point per request, with a real
            screenshot of the actual Settings section that does this. Text
            and image are wrapped in a shared flex container so the image is
            centered against the FULL text block (heading + paragraph +
            list), not just whichever line happens to be tallest. */}
        <section id="import" className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <Reveal className="flex flex-col justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-100 text-gold-600">
                <FileSpreadsheet size={20} />
              </div>
              <h2 className="mt-4 font-display text-2xl font-medium text-brown-900 sm:text-3xl">
                Switch from your old system in an afternoon
              </h2>
              <p className="mt-3 text-brown-600">
                Already tracking patients in Excel, a notebook, or another piece of software?
                You don&apos;t start from zero. Bring in your existing patient list and their full
                session history straight from a CSV or Excel file — map your columns, preview
                what&apos;s about to be imported, and bring it in all at once.
              </p>
              <ul className="mt-5 space-y-3 text-sm text-brown-700">
                <li className="flex items-start gap-2.5">
                  <Check size={18} className="mt-0.5 flex-shrink-0 text-gold-600" />
                  <span>
                    <strong className="font-medium text-brown-900">Patients</strong> — name,
                    contact, skin type, and contraindications, matched against existing records so
                    nobody gets duplicated
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={18} className="mt-0.5 flex-shrink-0 text-gold-600" />
                  <span>
                    <strong className="font-medium text-brown-900">Session history</strong> — past
                    visit dates, treated areas, and fees, one file per treatment type
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check size={18} className="mt-0.5 flex-shrink-0 text-gold-600" />
                  <span>You choose Skip or Replace for anything that looks like a duplicate</span>
                </li>
              </ul>
            </Reveal>
            <Reveal delayMs={120} className="flex items-center">
              <ProductShot src="/screenshots/settings-import.png" alt="Import Patients and Import Session History sections in RadianceLaser Settings" />
            </Reveal>
          </div>
        </section>

        {/* Smaller, still-real features that don't need a full row each —
            the three boxes, at the bottom of the features block. */}
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {SECONDARY_FEATURES.map(({ icon: Icon, title, description }, i) => (
              <Reveal key={title} delayMs={i * 80}>
                <div className="h-full rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300 transition-shadow duration-300 hover:shadow-card">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-100 text-gold-600">
                    <Icon size={20} />
                  </div>
                  <h4 className="mt-4 font-display text-lg font-medium text-brown-900">{title}</h4>
                  <p className="mt-2 text-sm text-brown-600">{description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-3xl px-6 py-20">
          <Reveal>
            <div className="rounded-2xl bg-brown-900 p-10 text-center text-beige-200 shadow-card">
              <div className="flex items-center justify-center gap-2 text-sm uppercase tracking-wide text-gold-500">
                <Receipt size={16} />
                <span>Simple, flat pricing</span>
              </div>
              <div className="mt-4 font-display text-4xl font-medium text-white">
                ₹{ANNUAL_PRICE_INR.toLocaleString("en-IN")}
                <span className="text-lg font-normal text-beige-200">/year</span>
              </div>
              <p className="mt-2 text-sm text-beige-200">
                One clinic, unlimited staff accounts, every feature included. No tiers, no
                per-seat charges.
              </p>
              <p className="mt-1 text-sm text-beige-200">
                Try it free for {trialMonths} months first — no credit card needed to start.
              </p>
              <Link
                href="/signup"
                className="mt-6 inline-block rounded-md bg-gold-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-gold-500 hover:shadow-card"
              >
                Start Your Free Trial
              </Link>
            </div>
          </Reveal>
        </section>

        {/* Footer */}
        <footer className="border-t border-beige-300 py-8 text-center text-sm text-brown-400">
          © {new Date().getFullYear()} RadianceLaser
        </footer>
      </div>
    </div>
  );
}
