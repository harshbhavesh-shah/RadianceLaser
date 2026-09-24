import Image from "next/image";
import { ArrowIcon, Eyebrow, H2_CLASS, Wrap } from "./ui";

const SPREADSHEET_ROWS = [
  { name: "Jane Doe", phone: "555-1234", lastVisit: "12/10/2023", treatment: "Laser Hair Removal" },
  { name: "Amos B", phone: "5550192834", lastVisit: "10-Aug-24", treatment: "Skin Rejuvenation" },
  { name: "Amos Burton", phone: "019-2834", lastVisit: "August 10, 2024", treatment: "Skin Rejuvenation" },
  { name: "Priya S", phone: "", lastVisit: "yesterday", treatment: "Full Body SHR" },
  { name: "Chrisjen Avasarala", phone: "555.999.0000", lastVisit: "05-01-2024", treatment: "Chemical Peel" },
];

const STRIPES =
  "bg-[repeating-linear-gradient(135deg,#FBF8F2_0px,#FBF8F2_14px,#F4EFE6_14px,#F4EFE6_28px)]";

/** Before/after: the messy sheet a clinic is probably already keeping (a
 * static illustration) next to a real screenshot of the Schedule page once
 * the same people (Jane Doe, Amos Burton, Priya S, Chrisjen Avasarala) are
 * in the system. */
export default function DataMigrationSection() {
  return (
    <section>
      <Wrap className="flex flex-col gap-12 py-16 md:gap-16 md:py-[120px] lg:pt-[140px]">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end lg:gap-16">
          <div className="flex max-w-[760px] flex-col gap-7">
            <Eyebrow>MIGRATION</Eyebrow>
            <h2 className={H2_CLASS}>Already tracking patients in Excel or a register? Bring it all with you.</h2>
          </div>
          <p className="max-w-[340px] text-base leading-relaxed text-lumi-soft md:text-[17px] md:leading-[1.6]">
            Import your existing sheet and every patient arrives with their history, sessions and packages in place.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-6 md:flex-row md:gap-7">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <span className="font-landing-mono text-[11px] tracking-[0.1em] text-lumi-mute">BEFORE · EXCEL / REGISTER</span>
            <div
              className={`flex min-h-[260px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-lumi-ink/[0.14] p-3 sm:p-6 ${STRIPES}`}
            >
              <div className="w-full overflow-hidden rounded-md border border-lumi-ink/15 bg-white">
                <table className="w-full table-fixed border-collapse text-left font-landing-mono text-[10px] text-lumi-mute sm:text-xs">
                  <thead>
                    <tr className="border-b border-lumi-ink/10 bg-lumi-card">
                      <th className="w-[30%] truncate border-r border-lumi-ink/10 p-2 font-semibold sm:p-3">NAME</th>
                      <th className="w-[26%] truncate border-r border-lumi-ink/10 p-2 font-semibold sm:p-3">PHONE</th>
                      <th className="w-[22%] truncate border-r border-lumi-ink/10 p-2 font-semibold sm:p-3">lastVisit</th>
                      <th className="truncate p-2 font-semibold sm:p-3">Treatment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SPREADSHEET_ROWS.map((row) => (
                      <tr key={row.name} className="border-b border-lumi-ink/10 last:border-b-0">
                        <td className="truncate border-r border-lumi-ink/10 p-2 text-lumi-ink sm:p-3">{row.name}</td>
                        <td className="truncate border-r border-lumi-ink/10 p-2 text-lumi-ink sm:p-3">{row.phone}</td>
                        <td className="truncate border-r border-lumi-ink/10 p-2 text-lumi-ink sm:p-3">{row.lastVisit}</td>
                        <td className="truncate p-2 text-lumi-ink sm:p-3">{row.treatment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="flex h-[72px] w-[72px] shrink-0 flex-col items-center justify-center gap-1 self-center rounded-full bg-lumi-accent text-white md:h-[88px] md:w-[88px]">
            <ArrowIcon className="h-[18px] w-[18px] rotate-90 md:rotate-0" />
            <span className="font-landing-mono text-[9px] tracking-[0.1em]">IMPORT</span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-[1.3]">
            <span className="font-landing-mono text-[11px] tracking-[0.1em] text-lumi-accent">AFTER · LUMIÈRE BY RADIANCE</span>
            <div className={`relative aspect-[1440/900] w-full overflow-hidden rounded-xl border border-lumi-ink/[0.14] ${STRIPES}`}>
              <Image
                src="/schedule-after.png"
                alt="Lumière by Radiance weekly schedule showing appointments for Jane Doe, Amos Burton, Priya S, and Chrisjen Avasarala"
                fill
                sizes="(min-width: 1200px) 480px, (min-width: 768px) 40vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </Wrap>
    </section>
  );
}
