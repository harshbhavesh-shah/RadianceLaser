"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "#security", label: "Data & Security" },
  { href: "#features", label: "Features" },
  { href: "#import", label: "Switch to Radiance" },
  { href: "#pricing", label: "Pricing" },
];

/** Sticky landing-page header. Sits flush against the hero at rest (no
 * background of its own, so it reads as part of the page); past a small
 * scroll threshold it picks up a frosted-glass background, blur, and a
 * hairline border so it reads as a distinct bar floating over whatever
 * scrolls underneath it.
 *
 * Layout is a 3-column grid (title / nav / actions) rather than
 * space-between flex, specifically so the nav links land dead-center in
 * the bar instead of merely centered in the leftover space next to the
 * title — the two only coincide when the title and actions happen to be
 * the same width. Below md, the center column becomes a hamburger toggle
 * for the same links instead of disappearing outright. */
export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled || menuOpen
          ? "border-b border-brown-900/10 bg-canvas/75 shadow-sm backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6">
        {/* Fraunces (the display serif) and Inter (everything else) don't
            share a baseline position at the same line-box center — measured
            in the browser, Fraunces sits ~2px low relative to Inter at
            these sizes, which reads as "off" once you look closely even
            though the boxes are centered correctly. Nudging it up those
            2px lines the two typefaces up on a shared baseline instead of
            just a shared box-center. */}
        <Link
          href="/"
          className="-translate-y-[2px] font-display text-lg font-medium leading-none text-brown-900 sm:text-xl"
        >
          RadianceLaser
        </Link>

        <nav className="hidden items-center justify-center gap-6 text-sm font-medium leading-none text-brown-600 md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="group relative py-1 transition-colors hover:text-gold-600">
              {link.label}
              <span className="absolute inset-x-0 -bottom-0.5 h-px scale-x-0 bg-gold-500 transition-transform duration-300 ease-out group-hover:scale-x-100" />
            </a>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="flex h-9 w-9 items-center justify-center rounded-md text-brown-700 hover:bg-brown-900/5 md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link
            href="/login"
            className="whitespace-nowrap text-sm font-medium leading-none text-brown-700 hover:text-gold-600"
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className="whitespace-nowrap rounded-md bg-brown-900 px-3 py-2 text-xs font-semibold leading-none text-beige-200 transition-all duration-150 hover:bg-gold-600 active:scale-95 sm:px-4 sm:text-sm"
          >
            <span className="sm:hidden">Start Trial</span>
            <span className="hidden sm:inline">Start Free Trial</span>
          </Link>
        </div>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-brown-900/10 px-4 py-3 text-sm font-medium text-brown-700 md:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-md px-2 py-2 transition-colors hover:bg-brown-900/5 hover:text-gold-600"
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
