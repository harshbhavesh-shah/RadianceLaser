import { Eyebrow, H2_CLASS, Wrap } from "./ui";

// Written after an actual line-by-line compliance review (see
// docs/incident-response-runbook.md and the AuditLog/erasure work it
// describes), not aspirational copy. The "what we do" lines are the
// original, precise wording; they don't claim a certification (HIPAA,
// SOC 2) that hasn't actually been obtained.
const REGISTER: { name: string; what: string; status: "COMPLIANT" | "ENFORCED" }[] = [
  {
    name: "DPDP Act 2023",
    what: "Consent captured at intake. Patients can request correction or permanent erasure at any time.",
    status: "COMPLIANT",
  },
  {
    name: "IT Act · SPDI Rules",
    what: "Data encrypted in transit. Two-factor sign-in available for every staff account.",
    status: "COMPLIANT",
  },
  {
    name: "CERT-In Directions",
    what: "Sensitive actions are logged with who did it and when, kept indefinitely.",
    status: "COMPLIANT",
  },
  {
    name: "Medical records retention",
    what: "A record cannot be erased until three years after the patient's last visit, enforced automatically.",
    status: "ENFORCED",
  },
  {
    name: "Per-clinic isolation",
    what: "Every request checked against the clinic before anything loads. No shared views between clinics, ever.",
    status: "ENFORCED",
  },
];

const HOSTING = [
  { label: "Databases", value: "AWS ap-south-1 · Mumbai" },
  { label: "Application", value: "Functions pinned · Mumbai" },
];

export default function SecuritySection() {
  return (
    <section id="security" className="mt-20 scroll-mt-20 bg-lumi-ink text-lumi-paper md:mt-[120px]">
      <Wrap className="flex flex-col gap-12 py-16 md:py-[120px] lg:flex-row lg:gap-24">
        <div className="flex flex-col gap-7 lg:w-[470px] lg:shrink-0">
          <Eyebrow className="text-lumi-ember">SECURITY</Eyebrow>
          <h2 className={H2_CLASS}>
            Your patients&apos; data{" "}
            <span className="font-landing-serif font-normal italic">stays in India.</span>
          </h2>
          <p className="text-base leading-relaxed text-[#BDB4A6] md:text-lg md:leading-[1.6]">
            Patient records live on servers in Mumbai, isolated clinic by clinic and encrypted in transit. Lumière was
            built around India&apos;s data-protection and medical-records rules, not retrofitted to them.
          </p>
          <div className="mt-3 flex flex-col gap-3.5 rounded-xl border border-lumi-paper/[0.14] px-6 py-5">
            <span className="font-landing-mono text-[11px] tracking-[0.12em] text-lumi-faint">HOSTING</span>
            {HOSTING.map((h, i) => (
              <div key={h.label}>
                {i > 0 && <div className="mb-3.5 h-px bg-lumi-paper/10" />}
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[15px]">
                  <span>{h.label}</span>
                  <span className="font-landing-mono text-[13px] text-lumi-ember">{h.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-grow flex-col">
          <div className="flex justify-between border-b border-lumi-paper/30 pb-4 font-landing-mono text-[11px] tracking-[0.12em] text-lumi-faint">
            <span>COMPLIANCE REGISTER</span>
            <span>STATUS</span>
          </div>
          {REGISTER.map((row, i) => (
            <div
              key={row.name}
              className="flex flex-wrap items-start gap-x-6 gap-y-3 border-b border-lumi-paper/[0.12] py-6 md:items-center md:py-[26px]"
            >
              <span className="w-7 pt-1 font-landing-mono text-xs text-lumi-faint md:pt-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
                <span className="text-xl font-medium tracking-[-0.015em] md:text-[22px]">{row.name}</span>
                <span className="text-[15px] leading-relaxed text-lumi-stone">{row.what}</span>
              </div>
              <span className="ml-[52px] flex items-center gap-2 rounded-full border border-lumi-paper/20 px-3 py-[7px] font-landing-mono text-[11px] tracking-[0.1em] md:ml-0">
                <span className="h-1.5 w-1.5 rounded-full bg-lumi-ember" />
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </Wrap>
    </section>
  );
}
