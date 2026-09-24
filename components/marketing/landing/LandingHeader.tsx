"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ArrowIcon, LogoMark, Wrap } from "./ui";

// Plain hash links: this header only renders on "/", so they resolve
// against the landing page itself.
const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#security", label: "Security" },
  { href: "#pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

/** Dark status strip plus a sticky nav. The strip scrolls away; the nav
 * stays. They are siblings (not one wrapper) so the sticky nav's containing
 * block is the whole page rather than a header that scrolls out of view. */
export default function LandingHeader({ trialLengthLabel }: { trialLengthLabel: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div className="bg-lumi-ink text-lumi-dust">
        <Wrap className="flex h-9 items-center justify-between gap-6 font-landing-mono text-[11px] uppercase tracking-[0.1em]">
          <div className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-lumi-ember" />
            <span>Data region · AWS ap-south-1 · Mumbai</span>
          </div>
          <span className="hidden lg:block">DPDP Act 2023 compliant</span>
          <span className="hidden md:block">Free for {trialLengthLabel} · No card required</span>
        </Wrap>
      </div>

      <header className="sticky top-0 z-50 border-b border-lumi-ink/10 bg-lumi-paper/90 backdrop-blur-md">
        <Wrap className="flex h-16 items-center justify-between gap-4 md:h-20">
          <Link href="/" aria-label="Lumière by Radiance home" className="flex items-center gap-3 text-lumi-ink">
            <LogoMark />
            <span className="text-xl font-semibold tracking-[-0.02em]">Lumière</span>
            <span className="hidden rounded border border-lumi-ink px-[7px] py-1 font-landing-mono text-[11px] tracking-[0.14em] sm:inline-block">
              BY RADIANCE
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-10 text-[15px] lg:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="transition-colors hover:text-lumi-accent">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="hidden px-4 py-3 text-[15px] transition-colors hover:text-lumi-accent lg:block">
              Log in
            </Link>
            <Link
              href="/signup"
              className="flex h-11 items-center gap-2.5 whitespace-nowrap rounded-full bg-lumi-ink px-4 text-sm font-medium text-lumi-paper transition-colors hover:bg-lumi-accent sm:px-5 sm:text-[15px]"
            >
              <span className="sm:hidden">Start trial</span>
              <span className="hidden sm:inline">Start free trial</span>
              <ArrowIcon className="hidden sm:block" />
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="flex h-11 w-11 items-center justify-center rounded-full text-lumi-ink transition-colors hover:bg-lumi-ink/5 lg:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </Wrap>

        {menuOpen && (
          <nav aria-label="Mobile" className="border-t border-lumi-ink/10 lg:hidden">
            <Wrap className="flex flex-col py-2 text-base">
              {[...NAV_LINKS, { href: "/login", label: "Log in" }].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="border-b border-lumi-ink/10 py-3.5 last:border-b-0"
                >
                  {link.label}
                </a>
              ))}
            </Wrap>
          </nav>
        )}
      </header>
    </>
  );
}
