import Link from "next/link";
import { Check } from "lucide-react";
import type { TierPricing } from "@/lib/db/platformSettings";

interface PricingTier {
  name: string;
  price: string;
  cadence?: string;
  fromLabel?: string;
  tagline: string;
  features: { label: string; bold?: boolean }[];
  cta: string;
  href: string;
  highlight?: boolean;
}

// Basic/Standard/Pro/Enterprise's prices come from the admin-editable
// platform settings (see app/admin/pricing), not hardcoded here, so a
// super admin can actually change what this page advertises — Free is
// always ₹0 and isn't stored. Feature lists and wording match the design
// exactly; only the numbers are ever live-swapped.
function buildPricingTiers(pricing: TierPricing): PricingTier[] {
  const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

  return [
    {
      name: "Free",
      price: "₹0",
      tagline: "Get a real clinic running, no card required.",
      features: [
        { label: "Scheduling and appointments" },
        { label: "Patient records and visit logging" },
        { label: "Receipts and billing" },
        { label: "E-signature consent forms" },
        { label: "Up to 500 patients" },
        { label: "2 staff logins" },
      ],
      cta: "Start free",
      href: "/signup",
    },
    {
      name: "Basic",
      price: inr(pricing.basicPriceInr),
      cadence: "/year",
      tagline: "For a clinic ready to run on more than the basics.",
      features: [
        { label: "Everything in Free", bold: true },
        { label: "Analytics dashboard" },
        { label: "Inventory management" },
        { label: "WhatsApp connect and send" },
        { label: "Before/after photo galleries" },
        { label: "Custom treatment types" },
        { label: "Unlimited patients" },
      ],
      cta: "Start free trial",
      href: "/signup",
    },
    {
      name: "Standard",
      price: inr(pricing.standardPriceInr),
      cadence: "/year",
      tagline: "Remove the staff ceiling and get organized.",
      features: [
        { label: "Everything in Basic", bold: true },
        { label: "No-show and follow-up tracking" },
        { label: "Custom package types" },
        { label: "Unlimited staff" },
      ],
      cta: "Start free trial",
      href: "/signup",
    },
    {
      name: "Pro",
      price: inr(pricing.proPriceInr),
      cadence: "/year",
      tagline: "Put your reminders and follow-ups on autopilot.",
      features: [
        { label: "Everything in Standard", bold: true },
        { label: "Two-way WhatsApp Inbox" },
        { label: "Automated reminders and feedback surveys" },
        { label: "Priority support" },
        { label: "White-glove setup and data migration" },
      ],
      cta: "Start free trial",
      href: "/signup",
      highlight: true,
    },
    {
      name: "Enterprise",
      price: inr(pricing.enterpriseMinPriceInr),
      cadence: "/year",
      fromLabel: "From",
      tagline: "For chains with 2 to 10 locations, one bill.",
      features: [
        { label: "Everything in Pro", bold: true },
        { label: "2 to 10 clinic locations" },
        { label: "Per-center price drops as you add locations" },
        { label: "Dedicated support" },
      ],
      cta: "Talk to us",
      href: "/contact",
    },
  ];
}

export default function PricingSection({ pricing }: { pricing: TierPricing }) {
  const tiers = buildPricingTiers(pricing);

  return (
    <section id="pricing" className="flex w-full scroll-mt-24 flex-col items-center bg-canvas px-4 pb-32 md:px-6">
      <div className="mb-12 mt-24 flex max-w-3xl flex-col items-center text-center md:mb-16">
        <h2 className="mb-5 text-3xl font-extrabold leading-tight tracking-tight text-brown-900 md:text-4xl lg:text-[40px]">
          Simple, transparent pricing
        </h2>
        <p className="text-lg font-medium leading-relaxed text-brown-400 md:text-xl">
          No per-seat pricing games. See the real number every time. Free for 1 month, no credit
          card needed to start.
        </p>
      </div>

      <div className="grid w-full max-w-[1200px] grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`relative flex h-full flex-col rounded-[18px] bg-white p-6 shadow-soft ${
              tier.highlight ? "border-2 border-rust-600 shadow-card lg:-mt-4 lg:mb-[-16px]" : "border border-beige-300"
            }`}
          >
            {tier.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-rust-600 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-soft">
                Most Popular
              </div>
            )}
            <h3
              className={`mb-2 text-sm font-bold uppercase tracking-wider ${
                tier.highlight ? "mt-2 text-rust-600" : "text-brown-400"
              }`}
            >
              {tier.name}
            </h3>
            {tier.fromLabel && <div className="mb-1 text-xl font-medium text-brown-400">{tier.fromLabel}</div>}
            <div className="mb-4 text-3xl font-extrabold text-brown-900">
              {tier.price}
              {tier.cadence && <span className="text-lg font-semibold text-brown-400">{tier.cadence}</span>}
            </div>
            <p className="mb-6 flex-1 text-sm font-medium leading-relaxed text-brown-400">{tier.tagline}</p>
            <div className="mb-8 space-y-3">
              {tier.features.map((f) => (
                <div key={f.label} className="flex items-start gap-2">
                  <Check
                    className={`mt-0.5 h-4 w-4 shrink-0 ${tier.highlight ? "text-rust-600" : "text-brown-400"}`}
                  />
                  <span className={`text-sm text-brown-900 ${f.bold ? "font-bold" : "font-medium"}`}>{f.label}</span>
                </div>
              ))}
            </div>
            <Link
              href={tier.href}
              className={
                tier.highlight
                  ? "mt-auto w-full rounded-xl bg-rust-600 px-4 py-3 text-center font-bold text-white shadow-soft transition-colors hover:bg-rust-700"
                  : "mt-auto w-full rounded-xl border border-beige-300 bg-white px-4 py-3 text-center font-bold text-brown-900 transition-colors hover:bg-beige-100/50"
              }
            >
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
