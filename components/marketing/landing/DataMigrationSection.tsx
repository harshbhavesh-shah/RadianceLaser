import { ArrowRight } from "lucide-react";
import Image from "next/image";

const SPREADSHEET_ROWS = [
  { name: "Jane Doe", phone: "555-1234", lastVisit: "12/10/2023", treatment: "Laser Hair Removal" },
  { name: "Amos B", phone: "5550192834", lastVisit: "10-Aug-24", treatment: "Skin Rejuvenation" },
  { name: "Amos Burton", phone: "019-2834", lastVisit: "August 10, 2024", treatment: "Skin Rejuvenation" },
  { name: "Priya S", phone: "", lastVisit: "yesterday", treatment: "Full Body SHR" },
  { name: "Chrisjen Avasarala", phone: "555.999.0000", lastVisit: "05-01-2024", treatment: "Chemical Peel" },
];

/** Before/after — the messy spreadsheet a clinic is probably already
 * keeping (a static illustration), next to a real screenshot of Radiance's
 * Schedule page once the same people (Jane Doe, Amos Burton, Priya S,
 * Chrisjen Avasarala) are actually in the system. */
export default function DataMigrationSection() {
  return (
    <section className="mx-auto mb-24 flex w-full max-w-[1200px] flex-col items-center px-4 md:mb-32 md:px-6">
      <div className="mb-12 max-w-3xl text-center md:mb-16">
        <h2 className="mb-5 text-3xl font-extrabold leading-tight tracking-tight text-brown-900 md:text-4xl lg:text-[40px]">
          Already tracking patients in Excel or a register? Bring it all with you.
        </h2>
        <p className="text-lg font-medium leading-relaxed text-brown-400 md:text-xl">
          See exactly what is about to be added before you confirm it. Most clinics are fully
          switched over in an afternoon.
        </p>
      </div>

      <div className="relative flex w-full max-w-[900px] flex-col items-center gap-8">
        {/* Before: messy spreadsheet */}
        <div className="flex w-full flex-col items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-brown-400">Before</span>
          <div className="relative flex w-full items-center justify-center overflow-hidden rounded-[24px] border border-beige-300 bg-white p-4 shadow-soft md:p-8">
            <div className="flex w-full flex-col overflow-hidden border border-beige-300 bg-white text-left shadow-soft">
              <table className="w-full table-fixed border-collapse font-mono text-[11px] text-brown-400 sm:text-sm md:text-base">
                <thead>
                  <tr className="border-b border-beige-300/50 bg-beige-100/30">
                    <th className="w-[28%] truncate border-r border-beige-300/50 p-2.5 text-left font-bold sm:p-4 md:p-5">
                      NAME
                    </th>
                    <th className="w-[24%] truncate border-r border-beige-300/50 p-2.5 text-left font-bold sm:p-4 md:p-5">
                      PHONE
                    </th>
                    <th className="w-[22%] truncate border-r border-beige-300/50 p-2.5 text-left font-bold sm:p-4 md:p-5">
                      lastVisit
                    </th>
                    <th className="truncate p-2.5 text-left font-bold sm:p-4 md:p-5">Treatment</th>
                  </tr>
                </thead>
                <tbody>
                  {SPREADSHEET_ROWS.map((row) => (
                    <tr key={row.name} className="border-b border-beige-300/50">
                      <td className="truncate border-r border-beige-300/50 p-2.5 sm:p-4 md:p-5">{row.name}</td>
                      <td className="truncate border-r border-beige-300/50 p-2.5 sm:p-4 md:p-5">{row.phone}</td>
                      <td className="truncate border-r border-beige-300/50 p-2.5 sm:p-4 md:p-5">
                        {row.lastVisit}
                      </td>
                      <td className="truncate p-2.5 sm:p-4 md:p-5">{row.treatment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Transition arrow */}
        <div className="flex shrink-0 rotate-90 justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-beige-300 bg-white text-rust-600 shadow-soft">
            <ArrowRight className="h-6 w-6" strokeWidth={2.5} />
          </div>
        </div>

        {/* After: real screenshot of Radiance's Schedule page, with the
            same four people from the "before" spreadsheet now booked in.
            Sized to its natural aspect ratio (not squeezed into a short
            fixed-height box) so the schedule stays crisp and legible. */}
        <div className="flex w-full flex-col items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-rust-600">After</span>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[24px] border border-beige-300 bg-white p-4 shadow-soft sm:aspect-[1440/900] md:p-8">
            <div className="relative h-full w-full overflow-hidden rounded-[12px] border border-beige-300 shadow-soft">
              <Image
                src="/schedule-after.png"
                alt="Lumière by Radiance weekly schedule showing appointments for Jane Doe, Amos Burton, Priya S, and Chrisjen Avasarala"
                fill
                sizes="(min-width: 768px) 900px, 100vw"
                className="object-cover object-top"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
