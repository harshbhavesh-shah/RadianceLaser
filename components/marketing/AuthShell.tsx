import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/** Shared shell for /login and /signup. Split-screen layout (dark brand
 * panel + product shot on the left, the form on the right), re-skinned to
 * match the rest of the public site: font-brand headline, plain bg-brown-900
 * panel with no gradient or glow, same treatment as the pricing section on
 * the landing page. The brand panel is desktop-only (lg:flex) — collapsing
 * it on mobile rather than stacking it above the form, since a screenshot
 * above the fold pushes the actual sign-in fields down for no benefit on a
 * phone. Each page still owns its own card content (children) — this only
 * provides the surrounding frame. */
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="relative hidden overflow-hidden bg-brown-900 lg:flex lg:flex-col lg:justify-center lg:px-16 lg:py-16">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="" width={32} height={32} />
            <span className="font-logo text-lg text-white">
              Radiance <span className="text-gold-400">Laser</span>
            </span>
          </Link>
          <h2 className="mt-10 max-w-sm font-brand text-3xl font-extrabold leading-tight text-white">
            Run your clinic. Not a spreadsheet.
          </h2>
          <p className="mt-3 max-w-sm text-beige-300">
            Patients, appointments, packages, and revenue, all in one place.
          </p>
          <div className="relative mt-10 overflow-hidden rounded-xl border border-white/10 shadow-2xl">
            <Image
              src="/screenshots/dashboard-today.png"
              alt="Radiance Laser dashboard"
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
