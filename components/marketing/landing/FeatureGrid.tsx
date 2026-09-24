import type { ReactNode } from "react";
import { Eyebrow, H2_CLASS, Wrap } from "./ui";

const stroke = { stroke: "currentColor", strokeWidth: 1.5 } as const;
const accentStroke = { strokeWidth: 2 } as const;

const FEATURES: { title: string; description: string; icon: ReactNode }[] = [
  {
    title: "Prepaid packages",
    description: "Sell six sittings at once. The remaining balance is always visible at the desk.",
    icon: (
      <>
        <rect x="4" y="9" width="28" height="19" rx="3" {...stroke} />
        <path d="M4 15h28" {...stroke} />
        <path d="M9 22h8" className="stroke-lumi-accent" {...accentStroke} />
      </>
    ),
  },
  {
    title: "Digital consent forms",
    description: "Signed on a tablet, filed with the patient, receipt tracked.",
    icon: (
      <>
        <path d="M9 4h13l6 6v22H9z" {...stroke} />
        <path d="M13 16h11M13 21h8" {...stroke} />
        <path d="M13 27c2-2 3 1 5-1s2 1 4 0" className="stroke-lumi-accent" {...accentStroke} />
      </>
    ),
  },
  {
    title: "Before / after galleries",
    description: "Progress photos, blurred by default until someone chooses to look.",
    icon: (
      <>
        <rect x="4" y="8" width="13" height="20" rx="2" {...stroke} />
        <rect x="19" y="8" width="13" height="20" rx="2" {...stroke} />
        <path d="M22 14l7 7M22 20l4 4M25 11l4 4" className="stroke-lumi-accent" strokeWidth="1.5" />
      </>
    ),
  },
  {
    title: "Inventory",
    description: "Gels, tips and consumables tracked, with a nudge before you run low.",
    icon: (
      <>
        <path d="M6 12l12-6 12 6v14l-12 6-12-6z" {...stroke} />
        <path d="M6 12l12 6 12-6M18 18v14" {...stroke} />
        <circle cx="28" cy="8" r="4" className="fill-lumi-accent" />
      </>
    ),
  },
];

/** "The smaller things that add up": four short feature cards. */
export default function FeatureGrid() {
  return (
    <section>
      <Wrap className="flex flex-col gap-10 pb-16 pt-2 md:gap-14 md:pb-[140px] md:pt-10">
        <div className="flex flex-col gap-7">
          <Eyebrow>DETAILS</Eyebrow>
          <h2 className={H2_CLASS}>The smaller things that add up.</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex flex-col gap-10 rounded-2xl border border-lumi-ink/10 bg-lumi-card p-7 md:gap-14"
            >
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true" className="text-lumi-ink">
                {f.icon}
              </svg>
              <div className="flex flex-col gap-2.5">
                <h3 className="text-xl font-semibold tracking-[-0.015em]">{f.title}</h3>
                <p className="text-[15px] leading-normal text-lumi-soft">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Wrap>
    </section>
  );
}
