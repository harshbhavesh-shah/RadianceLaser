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
import SiteHeader from "@/components/marketing/SiteHeader";

const SECONDARY_FEATURES: { icon: typeof Users; title: string; description: string }[] = [
  {
    icon: Package,
    title: "Prepaid Packages",
    description:
      "Sell session bundles with a usage count computed live from actual visits, instead of a stored number that can quietly drift out of sync.",
  },
  {
    icon: ImageIcon,
    title: "Before/After Photo Galleries",
    description:
      "Track progress per patient, with a blur toggle for sensitive photos so a glance at the screen doesn't show more than it should.",
  },
  {
    icon: Users,
    title: "Duplicate-Safe Patient Records",
    description:
      "Skin type, contraindications, and full visit history in one place, with duplicate-phone detection so the same patient doesn't end up with two records.",
  },
];

const SECURITY_POINTS: { icon: typeof ShieldCheck; title: string; description: string }[] = [
  {
    icon: ShieldCheck,
    title: "Isolation enforced at the database, not just the app",
    description:
      "Every clinic's data carries a clinic ID, and Firestore's own security rules reject any read or write where that ID doesn't match the signed-in staff member's own clinic. That check happens at the database, not in application code you'd have to trust — even a leaked document link from another clinic can't be opened.",
  },
  {
    icon: KeyRound,
    title: "Secure session handling",
    description:
      "Sign-in tokens live in HttpOnly cookies, invisible to any script running on the page, and get verified server-side on every request. That's separate from the lightweight check that just redirects signed-out visitors away from the dashboard.",
  },
  {
    icon: Lock,
    title: "Role-based access",
    description:
      "Owner, doctor, and reception accounts see different things. Billing and staff management, for example, stay owner-only — enforced both on the page and on the underlying data request.",
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
    <div className="relative bg-canvas">
      {/* Same decorative glow treatment as /login and /signup — one visual
          identity from the first thing a visitor sees through to the
          product itself. Fades in on first paint (animate-glow-in) rather
          than just appearing at full opacity. The glow's own wrapper below
          already clips its blobs' bleed with its own overflow-hidden, so
          this outer div deliberately does NOT also set overflow-hidden —
          that would make it the nearest "scroll container" ancestor for
          SiteHeader's position: sticky and break the sticky-to-viewport
          behavior (sticky only sticks within its nearest such ancestor). */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[440px] overflow-hidden">
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
        <SiteHeader />

        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 pt-16 pb-8 text-center">
          <Reveal>
            <h1 className="font-display text-4xl font-medium leading-tight text-brown-900 sm:text-5xl">
              The one place to run your laser &amp; aesthetics clinic
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-brown-600">
              Patients, treatment sessions, appointments, packages, consent forms, receipts, and
              revenue, all in one system built around how a laser and aesthetics clinic actually
              runs its day.
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
              Today&apos;s schedule, business snapshot, and revenue, right when you open the dashboard
              each morning.
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
                "Revenue, staff, and machine-usage analytics that update live as visits get logged",
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
                Patient records deserve real protection, not just a compliance badge. Here&apos;s the
                actual architecture behind it.
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
                  Day, week, and month views. Click a booking and you can see that patient&apos;s
                  active packages and recent visits right there, without digging up their file
                  somewhere else.
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
                  See revenue by day, month, and year, how much comes from direct sessions versus
                  package redemptions, and which treatments, staff, and machines are actually
                  earning. It&apos;s computed live from the same visits and receipts your team
                  already logs, so there&apos;s no separate report to remember to run.
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
                  Clinic-branded consent templates, signed right on screen and locked the moment
                  they&apos;re signed. Receipts get sequential, gap-free numbers automatically, even
                  if two staff members happen to be issuing one at the exact same time.
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
                  Skin type, contraindications, and every visit on one page. Whether it&apos;s
                  Q-Switch, laser hair removal, or a custom machine type you&apos;ve added, each
                  session keeps its own fields — area, energy, passes, fee, and more.
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
                Already tracking patients in Excel, a notebook, or another system? You don&apos;t
                have to start over. Import your existing patient list and full session history
                straight from a CSV or Excel file — map your columns, preview what&apos;s coming
                in, and load it all at once.
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
