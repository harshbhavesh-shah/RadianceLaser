import Link from "next/link";
import type { TierPricing } from "@/lib/db/platformSettings";
import { Eyebrow, H2_CLASS, Wrap } from "./ui";

type Variant = "plain" | "featured" | "dark";

interface PricingTier {
  name: string;
  price: string;
  per: string;
  fromLabel?: string;
  items: string[];
  cta: string;
  href: string;
  variant: Variant;
}

// Basic/Standard/Pro/Enterprise prices come from the admin-editable
// platform settings (see app/admin/pricing), not hardcoded here, so a super
// admin can change what this page advertises. Free is always 0 and isn't
// stored. Only the numbers are ever live-swapped; the feature lists are the
// design's.
function buildTiers(pricing: TierPricing): PricingTier[] {
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return [
    {
      name: "FREE",
      price: "₹0",
      per: "forever",
      items: ["Up to 500 patients", "2 staff logins", "Scheduling & records", "Receipts & e-signatures"],
      cta: "Start free trial",
      href: "/signup",
      variant: "plain",
    },
    {
      name: "BASIC",
      price: inr(pricing.basicPriceInr),
      per: "per year",
      items: ["Unlimited patients", "WhatsApp messaging", "Analytics", "Inventory"],
      cta: "Start free trial",
      href: "/signup",
      variant: "plain",
    },
    {
      name: "STANDARD",
      price: inr(pricing.standardPriceInr),
      per: "per year",
      items: ["Everything in Basic", "Unlimited staff", "No-show tracking", "Custom packages"],
      cta: "Start free trial",
      href: "/signup",
      variant: "plain",
    },
    {
      name: "PRO",
      price: inr(pricing.proPriceInr),
      per: "per year",
      items: ["Everything in Standard", "Two-way WhatsApp inbox", "Automated reminders", "Priority support"],
      cta: "Start free trial",
      href: "/signup",
      variant: "featured",
    },
    {
      name: "ENTERPRISE",
      price: inr(pricing.enterpriseMinPriceInr),
      per: "per year",
      fromLabel: "from",
      items: ["2 to 10 clinic locations", "Tiered pricing", "Dedicated support"],
      cta: "Talk to us",
      href: "/contact",
      variant: "dark",
    },
  ];
}

const STYLES: Record<
  Variant,
  { card: string; label: string; muted: string; divider: string; check: string; button: string }
> = {
  plain: {
    card: "border border-lumi-ink/[0.12] bg-white text-lumi-ink",
    label: "text-lumi-accent",
    muted: "text-lumi-mute",
    divider: "bg-lumi-ink/[0.12]",
    check: "stroke-lumi-accent",
    button: "border border-lumi-ink/25 text-lumi-ink hover:border-lumi-ink",
  },
  featured: {
    card: "border-2 border-lumi-accent bg-lumi-tint text-lumi-ink shadow-[0_30px_60px_-30px_rgba(140,60,25,0.45)]",
    label: "text-lumi-accent",
    muted: "text-lumi-mute",
    divider: "bg-lumi-accent/25",
    check: "stroke-lumi-accent",
    button: "border border-lumi-accent bg-lumi-accent text-white hover:bg-lumi-accent-dark",
  },
  dark: {
    card: "border border-lumi-paper/[0.16] bg-lumi-ink text-lumi-paper",
    label: "text-lumi-ember",
    muted: "text-lumi-stone",
    divider: "bg-lumi-paper/[0.16]",
    check: "stroke-lumi-ember",
    button: "border border-lumi-paper bg-lumi-paper text-lumi-ink hover:bg-white",
  },
};

const INCLUDED = ["Scheduling", "Patient records", "Receipts & billing", "E-signatures"];

export default function PricingSection({ pricing }: { pricing: TierPricing }) {
  const tiers = buildTiers(pricing);

  return (
    <section id="pricing" className="scroll-mt-20 border-t border-lumi-ink/10 bg-lumi-card">
      <Wrap className="flex flex-col gap-10 py-16 md:gap-14 md:py-[120px]">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end lg:gap-16">
          <div className="flex flex-col gap-7">
            <Eyebrow>PRICING</Eyebrow>
            <h2 className={H2_CLASS}>Simple, transparent pricing.</h2>
          </div>
          <p className="max-w-[360px] text-base leading-relaxed text-lumi-soft md:text-[17px] md:leading-[1.6]">
            Start free for a month. Every price is on this page. No sales call needed to find out what it costs.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {tiers.map((t) => {
            const s = STYLES[t.variant];
            return (
              <div key={t.name} className={`flex flex-col gap-[22px] rounded-2xl px-[22px] py-[26px] ${s.card}`}>
                <div className="flex h-[22px] items-center justify-between">
                  <span className={`font-landing-mono text-[11px] tracking-[0.12em] ${s.label}`}>{t.name}</span>
                  {t.variant === "featured" && (
                    <span className="rounded-full bg-lumi-accent px-2 py-1 font-landing-mono text-[10px] tracking-[0.1em] text-white">
                      RECOMMENDED
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className={`text-xs ${s.muted} ${t.fromLabel ? "" : "hidden h-[18px] lg:block"}`}>{t.fromLabel}</span>
                  <span className="text-[34px] font-medium tracking-[-0.035em]">{t.price}</span>
                  <span className={`text-[13px] ${s.muted}`}>{t.per}</span>
                </div>
                <div className={`h-px ${s.divider}`} />
                <ul className="flex flex-grow flex-col gap-3">
                  {t.items.map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm leading-[1.4]">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
                        <path d="M2.5 7.5l3 3 6-7" className={s.check} strokeWidth="1.6" />
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={t.href}
                  className={`flex h-12 items-center justify-center rounded-full text-sm font-medium transition-colors ${s.button}`}
                >
                  {t.cta}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-lumi-ink/25 px-6 py-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
          <span className="font-landing-mono text-[11px] tracking-[0.12em] text-lumi-mute">EVERY PLAN INCLUDES</span>
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px]">
            {INCLUDED.map((item, i) => (
              <li key={item} className="flex items-center gap-6">
                {i > 0 && <span aria-hidden="true" className="text-[#C9BFAE]">/</span>}
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Wrap>
    </section>
  );
}
