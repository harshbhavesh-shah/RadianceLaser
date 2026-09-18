// Written after an actual line-by-line compliance review (see
// docs/incident-response-runbook.md and the AuditLog/erasure work it
// describes), not aspirational copy — doesn't claim a certification
// (HIPAA, SOC 2) that hasn't actually been obtained.
const LAW_TABLE: { law: string; whatWeDo: string }[] = [
  {
    law: "DPDP Act, 2023",
    whatWeDo: "Consent captured at intake. Patients can request correction or permanent erasure at any time.",
  },
  {
    law: "IT Act, SPDI Rules",
    whatWeDo: "Data encrypted in transit. Two-factor sign-in available for every staff account.",
  },
  {
    law: "Per-clinic isolation",
    whatWeDo: "Every request checked against the clinic before anything loads. No shared views between clinics, ever.",
  },
  {
    law: "CERT-In Directions",
    whatWeDo: "Sensitive actions are logged with who did it and when, kept indefinitely.",
  },
  {
    law: "Medical records retention",
    whatWeDo: "A record cannot be erased until three years after the patient's last visit, enforced automatically.",
  },
];

export default function SecuritySection() {
  return (
    <section id="security" className="mx-auto mb-24 w-full max-w-[1200px] scroll-mt-24 px-4 text-left md:mb-32 md:px-6">
      <div className="mb-12 max-w-3xl md:mb-16">
        <h2 className="mb-5 text-3xl font-extrabold leading-tight tracking-tight text-brown-900 md:text-4xl lg:text-[40px]">
          Your patients&apos; data stays in India.
        </h2>
        <p className="text-lg font-medium leading-relaxed text-brown-400 md:text-xl">
          Patient data is sensitive, and a clinic in India is bound by real legal requirements,
          not just good intentions. Every consent is captured at intake. Every record can be
          corrected or erased on request. Every database runs in Mumbai.
        </p>
      </div>

      <div className="flex flex-col divide-y divide-beige-300/60 overflow-hidden rounded-[18px] border border-beige-300 bg-white shadow-soft">
        {LAW_TABLE.map((row) => (
          <div
            key={row.law}
            className="flex flex-col gap-3 p-6 transition-colors hover:bg-beige-100/30 md:flex-row md:items-start md:gap-8 md:p-8"
          >
            <span className="shrink-0 pt-0.5 text-xs font-extrabold uppercase tracking-wide text-rust-600 md:w-64">
              {row.law}
            </span>
            <p className="font-medium leading-relaxed text-brown-900">{row.whatWeDo}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
