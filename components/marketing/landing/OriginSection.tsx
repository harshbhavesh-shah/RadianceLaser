import { Wrap } from "./ui";

export default function OriginSection() {
  return (
    <section className="border-t border-lumi-ink/10">
      <Wrap className="flex flex-col gap-10 py-16 md:py-[120px] lg:flex-row lg:items-center lg:gap-24">
        <p className="text-[26px] font-medium leading-[1.2] tracking-[-0.03em] sm:text-3xl lg:flex-grow lg:text-[40px]">
          Lumière began inside a working laser clinic, built by an engineer alongside a practising dermatologist.
        </p>
        <div className="flex flex-col gap-3.5 border-t border-lumi-ink/20 pt-6 lg:w-[320px] lg:shrink-0 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <span className="font-landing-mono text-[11px] tracking-[0.12em] text-lumi-mute">MEDICAL ADVISOR</span>
          <span className="text-[22px] font-semibold tracking-[-0.015em]">Dr. Bhavesh Shah</span>
          <span className="text-[15px] text-lumi-soft">MD Dermatology, DVD</span>
        </div>
      </Wrap>
    </section>
  );
}
