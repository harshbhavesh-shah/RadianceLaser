import Link from "next/link";
import { LogoMark, Wrap } from "./ui";

const PRODUCT_LINKS = [
  { href: "#product", label: "Overview" },
  { href: "#security", label: "Security" },
  { href: "#pricing", label: "Pricing" },
];

const COMPANY_LINKS = [
  { href: "/contact", label: "Contact" },
  { href: "/compliance", label: "Compliance" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-of-service", label: "Terms of Service" },
];

function LinkColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-3.5">
      <span className="font-landing-mono text-[11px] tracking-[0.12em] text-lumi-faint">{title}</span>
      {links.map((l) =>
        l.href.startsWith("#") ? (
          <a key={l.href} href={l.href} className="text-lumi-paper transition-colors hover:text-lumi-ember">
            {l.label}
          </a>
        ) : (
          <Link key={l.href} href={l.href} className="text-lumi-paper transition-colors hover:text-lumi-ember">
            {l.label}
          </Link>
        )
      )}
    </div>
  );
}

export default function LandingFooter() {
  return (
    <footer id="contact" className="bg-lumi-ink text-lumi-dust">
      <Wrap className="flex flex-col gap-12 pb-10 pt-14 md:gap-14 md:pb-14 md:pt-20">
        <div className="flex flex-col justify-between gap-10 md:flex-row md:gap-16">
          <div className="flex max-w-[360px] flex-col gap-[18px]">
            <div className="flex items-center gap-3 text-lumi-paper">
              <LogoMark className="h-7 w-7" />
              <span className="text-[19px] font-semibold tracking-[-0.02em]">Lumière by Radiance</span>
            </div>
            <span className="text-[15px] leading-relaxed">
              Clinic software for laser and aesthetic clinics. Made in India, hosted in India.
            </span>
          </div>
          <div className="flex gap-16 text-[15px] md:gap-24">
            <LinkColumn title="PRODUCT" links={PRODUCT_LINKS} />
            <LinkColumn title="COMPANY" links={COMPANY_LINKS} />
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-lumi-paper/[0.14] pt-6 font-landing-mono text-[11px] tracking-[0.06em] text-lumi-faint lg:flex-row lg:flex-wrap lg:justify-between lg:gap-x-8">
          <span>© {new Date().getFullYear()} LUMIÈRE BY RADIANCE</span>
          <span>DATA HOSTED IN INDIA · DPDP ACT 2023 COMPLIANT</span>
          <span>UDYAM REGISTERED · UDYAM-GJ-20-0310289</span>
          <span>MEDICAL ADVISOR · DR. BHAVESH SHAH, MD DERMATOLOGY, DVD</span>
        </div>
      </Wrap>
    </footer>
  );
}
