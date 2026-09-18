const FEATURES = [
  {
    title: "Prepaid Packages",
    description: "Prepaid packages that always show what is left.",
  },
  {
    title: "Consent Forms",
    description: "Consent signed on screen, tied to a clean receipt number.",
  },
  {
    title: "Before & After Photos",
    description: "Before and after photos, blurred until you choose to view them.",
  },
  {
    title: "Smart Inventory",
    description: "Stock that flags itself before you run out.",
  },
];

/** Four small feature cards, title + description only — no icons or
 * mockups. Each title gets the same short rust-600 underline the real
 * product's own page titles use (see app/dashboard/page.tsx's "Today at
 * a glance" and WeekAgenda's "This Week"), so the marketing page visually
 * echoes the actual software instead of inventing its own card language. */
export default function FeatureGrid() {
  return (
    <section className="mx-auto mb-24 flex w-full max-w-[1200px] flex-col items-center px-4 md:mb-32 md:px-6">
      <div className="mb-12 max-w-2xl text-center md:mb-16">
        <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-brown-900 md:text-4xl">
          The smaller things that add up.
        </h2>
        <p className="text-lg font-medium leading-relaxed text-brown-400 md:text-xl">
          Every detail is designed to solve a specific, real-world friction point for your staff.
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ title, description }) => (
          <div
            key={title}
            className="flex flex-col rounded-[18px] border border-beige-300 bg-white p-6 shadow-soft md:p-8"
          >
            <div className="inline-block self-start">
              <h3 className="text-lg font-extrabold tracking-tight text-brown-900">{title}</h3>
              <div className="mt-1.5 h-[3px] w-full rounded-full bg-rust-600" />
            </div>
            <p className="mt-4 text-sm font-medium leading-relaxed text-brown-400">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
