import Link from "next/link";
import SiteHeader from "@/components/marketing/SiteHeader";

const ROWS: { law: string; requires: string; whatWeDo: string }[] = [
  {
    law: "Digital Personal Data Protection Act, 2023 (DPDP Act)",
    requires:
      "Consent before collecting a patient's personal data, and the right for them to later access, correct, or ask you to erase it.",
    whatWeDo:
      "Every patient's consent to have their data processed is captured and timestamped at intake. An owner can look up, correct, or erase a patient's record at any time from that patient's page — erasure permanently deletes the record, it doesn't just hide it.",
  },
  {
    law: "IT Act, 2000 — Sensitive Personal Data or Information (SPDI) Rules, 2011",
    requires:
      "\"Reasonable security practices\" for sensitive personal data — health information counts — plus consent for collecting and using it.",
    whatWeDo:
      "Data in transit to the database is encrypted. Every staff account can turn on two-factor sign-in. And every clinic's data is walled off from every other clinic's at the database level — there's no shared view, ever, by design.",
  },
  {
    law: "CERT-In Directions, 2022",
    requires:
      "Report security incidents to CERT-In within 6 hours of detecting them, and retain system logs for a minimum period.",
    whatWeDo:
      "Every sensitive action — a record created, changed, or erased — is logged with who did it and when, kept indefinitely rather than just the minimum window. We follow a written incident-response process built specifically around that 6-hour clock.",
  },
  {
    law: "Clinical Establishments (Registration and Regulation) Act, 2010, or your state's equivalent",
    requires:
      "A registered clinic must keep patient records in a proper, retrievable form and be able to produce them on request.",
    whatWeDo:
      "Registering your clinic is still your own responsibility — that doesn't change. What we handle is the record-keeping itself: every patient's visits, consent forms, and receipts live in one searchable record you can pull up, or print, in seconds.",
  },
  {
    law: "Indian Medical Council (Professional Conduct, Etiquette and Ethics) Regulations, 2002 — Regulation 1.3.1",
    requires:
      "Indoor patient records must be kept for at least 3 years from a patient's last treatment (5 years for NABH-accredited clinics).",
    whatWeDo:
      "We enforce this automatically. A patient's record can't be erased — even on request, even by an owner — until 3 years have passed since their last visit. The system tells you exactly what date that is.",
  },
  {
    law: "Electronic Health Record Standards / Ayushman Bharat Digital Mission (ABDM)",
    requires:
      "Nothing mandatory yet — an ABHA-linked health ID under ABDM is currently voluntary for private clinics, not a legal requirement.",
    whatWeDo:
      "We don't integrate with ABDM today. It isn't required for your clinic to be compliant, and it isn't something we've built yet — we'd rather say that plainly than leave it vague.",
  },
];

export default function CompliancePage() {
  return (
    <div className="bg-canvas">
      <SiteHeader forceSolid />

      <main className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
          Compliance & Data Protection
        </p>
        <h1 className="mt-4 font-display text-3xl font-medium leading-tight text-brown-900 sm:text-4xl">
          How RadianceLaser handles patient data under Indian law
        </h1>
        <p className="mt-4 max-w-2xl text-brown-600">
          This page describes how the software itself is built around the laws that govern patient
          data in India, in plain language rather than legal drafting. It isn&apos;t legal advice —
          how these obligations apply to your specific clinic is worth confirming with your own
          counsel, but this is exactly what the platform does today.
        </p>

        <div className="mt-10 overflow-x-auto rounded-xl ring-1 ring-beige-300">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-beige-100">
                <th className="px-5 py-3.5 font-display text-sm font-medium text-brown-900">Law</th>
                <th className="px-5 py-3.5 font-display text-sm font-medium text-brown-900">What it requires</th>
                <th className="px-5 py-3.5 font-display text-sm font-medium text-brown-900">
                  What RadianceLaser does
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-beige-300 bg-surface">
              {ROWS.map((row) => (
                <tr key={row.law} className="align-top">
                  <td className="px-5 py-5 font-medium text-brown-900">{row.law}</td>
                  <td className="px-5 py-5 text-brown-600">{row.requires}</td>
                  <td className="px-5 py-5 text-brown-600">{row.whatWeDo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-16">
          <h2 className="font-display text-xl font-medium text-brown-900">Where your data lives</h2>
          <p className="mt-3 max-w-2xl text-brown-600">
            Your clinic&apos;s database runs on AWS, hosted in Mumbai. Patient data is never routed
            through, or stored in, a data center outside India. Connections to that database are
            encrypted end to end, and every request is checked against your clinic before anything
            loads — even a shared or guessed link from another clinic&apos;s account won&apos;t open
            your records.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-medium text-brown-900">Questions</h2>
          <p className="mt-3 max-w-2xl text-brown-600">
            If you need more detail than this page covers — for an inspection, an accreditation
            application, or your own records — reach out and we&apos;ll walk through it directly.
          </p>
        </section>

        <Link
          href="/"
          className="mt-14 inline-block text-sm font-medium text-gold-600 transition-colors hover:text-gold-500"
        >
          ← Back to home
        </Link>
      </main>

      <footer className="border-t border-beige-300 py-8 text-center text-sm text-brown-400">
        <p>© {new Date().getFullYear()} RadianceLaser</p>
      </footer>
    </div>
  );
}
