import Image from "next/image";
import type { ReactNode } from "react";

/** Shared shell for /login and /signup — the split-screen layout (dark
 * brand panel + product shot on the left, the actual form on the right) is
 * the same "premium SaaS auth screen" pattern used by Linear, Vercel, and
 * Notion, in place of the plain centered-card-on-gradient look this used to
 * have. The brand panel is desktop-only (lg:flex) — collapsing it on
 * mobile rather than stacking it above the form, since a screenshot above
 * the fold pushes the actual sign-in fields down for no benefit on a phone.
 * Each page still owns its own card content (children) — this only
 * provides the surrounding frame and the ambient glow, identical to the
 * treatment on the marketing page. */
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[440px] overflow-hidden">
        <div
          className="animate-glow-in absolute left-1/2 top-[-200px] h-[420px] w-[420px] rounded-full bg-gold-100 blur-3xl"
          style={{ animationDelay: "0s", marginLeft: "-357px" }}
        />
        <div
          className="animate-glow-in absolute left-1/2 top-[-160px] h-[380px] w-[380px] rounded-full bg-rose-200/70 blur-3xl"
          style={{ animationDelay: "-5s", marginLeft: "-38px" }}
        />
        <div
          className="animate-glow-in absolute left-1/2 top-[-220px] h-[440px] w-[440px] rounded-full bg-violet-200/60 blur-3xl"
          style={{ animationDelay: "-10s", marginLeft: "88px" }}
        />
        <div
          className="animate-glow-in absolute left-1/2 top-[-140px] h-[360px] w-[360px] rounded-full bg-sky-200/60 blur-3xl"
          style={{ animationDelay: "-7s", marginLeft: "-504px" }}
        />
        <div
          className="animate-glow-in absolute left-1/2 top-[-180px] h-[340px] w-[340px] rounded-full bg-emerald-100/60 blur-3xl"
          style={{ animationDelay: "-12s", marginLeft: "220px" }}
        />
      </div>

      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        <div className="relative hidden overflow-hidden bg-brown-900 lg:flex lg:flex-col lg:justify-center lg:px-16 lg:py-16">
          <Image src="/logo.png" alt="" width={44} height={44} />
          <h2 className="mt-8 max-w-sm font-display text-3xl font-medium leading-tight text-white">
            Run your clinic without the spreadsheets.
          </h2>
          <p className="mt-4 max-w-sm text-beige-200/80">
            Patients, appointments, packages, and revenue, all in one place.
          </p>
          <div className="relative mt-10 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10">
            <Image
              src="/screenshots/dashboard-today.png"
              alt="RadianceLaser dashboard"
              width={1440}
              height={900}
              className="h-auto w-full"
              sizes="640px"
            />
          </div>
        </div>

        <div className="flex items-center justify-center px-4 py-12">{children}</div>
      </div>
    </div>
  );
}
