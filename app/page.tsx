import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { getSession } from "@/lib/session";
import { ANNUAL_PRICE_INR, TRIAL_LENGTH_DAYS } from "@/lib/subscription";
import SiteHeader from "@/components/marketing/SiteHeader";

// Written after an actual line-by-line compliance review (see
// docs/incident-response-runbook.md and the AuditLog/erasure work it
// describes), not aspirational copy. Doesn't claim a certification
// (HIPAA, SOC 2) that hasn't actually been obtained.
const LAW_TABLE: { law: string; whatWeDo: string }[] = [
  { law: "DPDP Act, 2023", whatWeDo: "Consent captured at intake. Patients can ask for correction or permanent erasure any time." },
  { law: "IT Act, SPDI Rules", whatWeDo: "Data encrypted in transit. Two-factor sign-in available for every staff account." },
  { law: "Per-clinic isolation", whatWeDo: "Every request checked against your clinic before anything loads. No shared views, ever." },
  { law: "CERT-In Directions", whatWeDo: "Sensitive actions are logged with who did it and when, kept indefinitely." },
  { law: "Medical records retention", whatWeDo: "A record can't be erased until 3 years after the patient's last visit, enforced automatically." },
];

// Real pixel dimensions vary shot to shot (a couple are non-retina crops,
// not the standard 2880x1800 export), so each one gets its own true
// width/height rather than a shared default — passing the wrong aspect
// ratio here is what previously stretched no-shows-followups.png into a
// half-empty box.
function ShowcaseShot({
  src,
  alt,
  width,
  height,
  sizes = "(min-width: 1024px) 640px, 100vw",
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-beige-300 shadow-card">
      <Image src={src} alt={alt} width={width} height={height} quality={90} className="h-auto w-full" sizes={sizes} />
    </div>
  );
}

const CONTAINER = "mx-auto max-w-6xl px-6";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const trialMonths = Math.round(TRIAL_LENGTH_DAYS / 30);
  const trialLengthLabel = `${trialMonths} month${trialMonths === 1 ? "" : "s"}`;

  return (
    <div className="bg-canvas">
      <SiteHeader />

      {/* Hero + first showcase, combined: headline and the dashboard proof
          share one row instead of a screenshot repeated lower down. Left
          alignment throughout the page starts here, so nothing later reads
          as a different layout system. */}
      <section className={`${CONTAINER} grid grid-cols-1 items-center gap-12 pt-14 pb-20 sm:pt-20 lg:grid-cols-2 lg:gap-14`}>
        <div>
          <h1 className="font-brand text-4xl font-extrabold leading-[1.1] tracking-tight text-brown-900 sm:text-5xl">
            Clinic software that stays out of your way.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-brown-600">
            Open the dashboard and you&apos;re looking at today: who&apos;s booked, who&apos;s
            already been seen, and who needs a callback. Revenue, new patients, and recent activity
            update as the day happens, pulled from the same data automatically rather than copied
            over from a spreadsheet.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-md bg-brown-900 px-6 py-3 text-sm font-semibold text-beige-100 transition-colors hover:bg-gold-600"
            >
              Start your free trial
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-brown-900/15 px-6 py-3 text-sm font-semibold text-brown-800 transition-colors hover:border-brown-900/30 hover:bg-brown-900/5"
            >
              Log in
            </Link>
          </div>
          <p className="mt-4 text-sm text-brown-400">
            Free for {trialLengthLabel} · No credit card required ·{" "}
            <Link href="/compliance" className="underline decoration-beige-300 underline-offset-4 hover:text-gold-600">
              data hosted in India
            </Link>
          </p>
        </div>

        <ShowcaseShot
          src="/screenshots/dashboard-today.png"
          alt="Today's schedule, business snapshot, and revenue chart on the RadianceLaser dashboard"
          width={2880}
          height={1800}
        />
      </section>

      {/* Automation. Image side stacks two real screens rather than
          squeezing them side by side into quarter-width crops. */}
      <section id="product" className="border-y border-beige-300 bg-beige-100/60">
        <div className={`${CONTAINER} grid grid-cols-1 items-center gap-12 py-20 lg:grid-cols-2 lg:gap-14`}>
          <div>
            <h2 className="font-brand text-3xl font-extrabold leading-tight text-brown-900 sm:text-4xl">
              Reminders and follow-ups that run themselves
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-brown-600">
              Every appointment gets a WhatsApp reminder before it happens, and every visit gets a
              short feedback survey after. Nobody at the front desk has to remember to send either.
              When a patient misses their appointment, Radiance follows up on its own: a message
              asking why, an offer to win them back, or a nudge to reschedule, depending on how
              you&apos;ve set it up. Turn any of these on or off per clinic, and watch no-show
              trends by week or month to see whether things are actually improving.
            </p>
          </div>
          <div className="flex flex-col gap-6">
            <ShowcaseShot
              src="/screenshots/communication-automation.png"
              alt="Automated appointment reminders and post-visit feedback survey results on the RadianceLaser Communication page"
              width={1440}
              height={900}
            />
            <ShowcaseShot
              src="/screenshots/no-shows-followups.png"
              alt="Configurable no-show follow-ups and recent no-shows list on the RadianceLaser No Shows page"
              width={1440}
              height={500}
            />
          </div>
        </div>
      </section>

      {/* Import */}
      <section className={`${CONTAINER} grid grid-cols-1 items-center gap-12 py-20 lg:grid-cols-2 lg:gap-14`}>
        <div>
          <h2 className="font-brand text-3xl font-extrabold leading-tight text-brown-900 sm:text-4xl">
            Bring in what you already have
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-brown-600">
            If you&apos;re already tracking patients in Excel, a register, or an old system, you
            don&apos;t have to re-enter anything by hand. Bring in your patient list and their
            session history from a spreadsheet, see exactly what&apos;s about to be added before
            you confirm it, and skip or replace anything that looks like a duplicate. Most clinics
            are fully switched over in an afternoon.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-brown-600">
            Radiance also handles the smaller things that add up over a week: day, week, and month
            calendar views for scheduling, prepaid session packages that always show exactly how
            many visits are left, consent forms patients sign on screen tied to receipts with clean
            sequential numbers, before-and-after photos kept blurred until you choose to view them,
            and separate views for owners, doctors, and reception.
          </p>
        </div>
        <ShowcaseShot
          src="/screenshots/settings-import.png"
          alt="Import Patients and Import Session History sections in RadianceLaser Settings"
          width={2880}
          height={1800}
        />
      </section>

      {/* Data privacy & security */}
      <section id="security" className="border-y border-beige-300 bg-beige-100/60">
        <div className={`${CONTAINER} grid grid-cols-1 gap-12 py-20 lg:grid-cols-2 lg:gap-14`}>
          <div>
            <h2 className="font-brand text-3xl font-extrabold leading-tight text-brown-900 sm:text-4xl">
              Your patients&apos; data stays in India.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-brown-600">
              Patient data is sensitive, and a clinic in India is bound by more than good intentions
              here. Your database runs in Mumbai, so a patient&apos;s record is never routed
              through, or stored in, another country. Every patient consents when they&apos;re
              added, and can ask for their record to be corrected or permanently erased at any
              time, exactly what the Digital Personal Data Protection Act requires.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-brown-600">
              The table alongside is how specific provisions in Indian law map to what actually
              happens inside the product, not a list of claims we&apos;re hoping nobody checks.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-beige-300 bg-surface">
            {LAW_TABLE.map((row, i) => (
              <div key={row.law} className={`px-5 py-5 ${i > 0 ? "border-t border-beige-300" : ""}`}>
                <span className="font-brand text-base font-bold text-brown-900">{row.law}</span>
                <p className="mt-1.5 text-base leading-relaxed text-brown-600">{row.whatWeDo}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing. Two columns, same as everything above it, instead of a
          narrow centered card floating on its own. */}
      <section id="pricing" className={`${CONTAINER} py-20`}>
        <div className="grid grid-cols-1 gap-10 rounded-2xl border border-beige-300 bg-surface p-8 shadow-card sm:p-12 lg:grid-cols-2 lg:items-center lg:gap-14">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold-600">Annual plan</p>
            <div className="mt-3 font-brand text-5xl font-extrabold text-brown-900 sm:text-6xl">
              ₹{ANNUAL_PRICE_INR.toLocaleString("en-IN")}
              <span className="text-lg font-medium text-brown-400">/year</span>
            </div>
          </div>
          <div>
            <p className="text-lg leading-relaxed text-brown-600">
              That covers one clinic with unlimited staff accounts, every role included.
              There&apos;s no per-seat pricing and no separate tier for automation, analytics, or
              WhatsApp reminders. Import your existing patients, invite your team, and everything
              above is already part of the plan.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-brown-900 px-6 py-3 text-sm font-semibold text-beige-100 transition-colors hover:bg-gold-600"
            >
              Start your free trial
              <ArrowRight size={16} />
            </Link>
            <p className="mt-3 text-sm text-brown-400">Free for {trialLengthLabel}. No credit card needed to start.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`${CONTAINER} border-t border-beige-300 py-8 text-sm text-brown-400`}>
        <p>
          © {new Date().getFullYear()} RadianceLaser ·{" "}
          <Link href="/compliance" className="underline decoration-beige-300 underline-offset-2 hover:text-gold-600">
            Data hosted in India, DPDP Act 2023 compliant
          </Link>
        </p>
        <p className="mt-1">Udyam Registered: UDYAM-GJ-20-0310289 · Medical Advisor: Dr. Bhavesh Shah</p>
      </footer>
    </div>
  );
}
