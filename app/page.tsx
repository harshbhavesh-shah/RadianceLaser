import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Sparkles,
  Calendar,
  Package,
  FileSignature,
  BarChart3,
  Receipt,
  Image as ImageIcon,
} from "lucide-react";
import { getSession } from "@/lib/session";
import { ANNUAL_PRICE_INR, TRIAL_LENGTH_DAYS } from "@/lib/subscription";

const FEATURES: { icon: typeof Users; title: string; description: string }[] = [
  {
    icon: Users,
    title: "Patient Records",
    description:
      "Skin type, contraindications, and full visit history in one place — with duplicate-phone detection so the same patient never gets two records by accident.",
  },
  {
    icon: Sparkles,
    title: "Treatment Sessions",
    description:
      "Log multi-area sessions for Q-Switch, LHR, or any custom machine type your clinic runs, each with its own tracked fields.",
  },
  {
    icon: Calendar,
    title: "Appointments",
    description: "Day, week, and month calendar views, with auto-complete once a visit is logged.",
  },
  {
    icon: Package,
    title: "Prepaid Packages",
    description:
      "Sell session bundles with a usage ledger computed live from actual visits — never a stored number that can drift out of sync.",
  },
  {
    icon: FileSignature,
    title: "Consent Forms & Receipts",
    description:
      "Clinic-branded consent templates signed on-screen, and itemized receipts with sequential, tamper-proof numbering.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Revenue and session breakdowns by treatment type, staff member, and machine.",
  },
];

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const trialMonths = Math.round(TRIAL_LENGTH_DAYS / 30);

  return (
    <div className="relative overflow-hidden bg-canvas">
      {/* Same decorative glow treatment as /login and /signup — one visual
          identity from the first thing a visitor sees through to the
          product itself. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[440px] overflow-hidden">
        <div
          className="animate-glow-drift absolute left-1/2 top-[-200px] h-[420px] w-[420px] rounded-full bg-gold-100 blur-3xl"
          style={{ animationDelay: "0s", marginLeft: "-357px" }}
        />
        <div
          className="animate-glow-drift absolute left-1/2 top-[-160px] h-[380px] w-[380px] rounded-full bg-rose-200/70 blur-3xl"
          style={{ animationDelay: "-5s", marginLeft: "-38px" }}
        />
        <div
          className="animate-glow-drift absolute left-1/2 top-[-220px] h-[440px] w-[440px] rounded-full bg-violet-200/60 blur-3xl"
          style={{ animationDelay: "-10s", marginLeft: "88px" }}
        />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <span className="font-display text-xl font-medium text-brown-900">RadianceLaser</span>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-brown-700 hover:text-gold-600">
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
            >
              Start Free Trial
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="mx-auto max-w-3xl px-6 pt-16 pb-20 text-center">
          <h1 className="font-display text-4xl font-medium leading-tight text-brown-900 sm:text-5xl">
            Run your laser &amp; aesthetics clinic from one place
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-brown-600">
            Patients, treatment sessions, appointments, packages, consent forms, and receipts —
            built specifically for laser and aesthetics clinics, not adapted from generic
            practice-management software.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-md bg-brown-900 px-6 py-3 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
            >
              Start Your Free Trial
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-beige-300 px-6 py-3 text-sm font-semibold text-brown-700 transition-colors hover:border-gold-500 hover:text-gold-600"
            >
              Log In
            </Link>
          </div>
          <p className="mt-4 text-sm text-brown-400">
            Free for {trialMonths} months. No credit card required to start.
          </p>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <h2 className="font-display text-2xl font-medium text-brown-900 sm:text-3xl">
              Everything day-to-day clinic work needs
            </h2>
            <div className="mx-auto mt-3 h-[2px] w-10 bg-gold-500" />
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-100 text-gold-600">
                  <Icon size={20} />
                </div>
                <h3 className="mt-4 font-display text-lg font-medium text-brown-900">{title}</h3>
                <p className="mt-2 text-sm text-brown-600">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Photos callout — kept separate from the grid since it's a smaller
            detail than the six main features above, not because it matters
            less operationally. */}
        <section className="mx-auto max-w-3xl px-6 pb-16">
          <div className="flex items-start gap-4 rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gold-100 text-gold-600">
              <ImageIcon size={20} />
            </div>
            <div>
              <h3 className="font-display text-lg font-medium text-brown-900">
                Before/After Photo Galleries
              </h3>
              <p className="mt-2 text-sm text-brown-600">
                Track progress per patient, with a sensitive-content blur toggle for anyone
                glancing at a screen who shouldn&apos;t see it.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="mx-auto max-w-3xl px-6 pb-20">
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
              className="mt-6 inline-block rounded-md bg-gold-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gold-500"
            >
              Start Your Free Trial
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-beige-300 py-8 text-center text-sm text-brown-400">
          © {new Date().getFullYear()} RadianceLaser
        </footer>
      </div>
    </div>
  );
}
