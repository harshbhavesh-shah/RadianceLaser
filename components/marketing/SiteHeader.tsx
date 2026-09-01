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
 * background of its own, so it reads as part of the page) — but the hero
 * itself is now a dark warm-brown panel (see app/page.tsx), so "at rest"
 * also means light-colored text/button here, not the dark-on-canvas
 * styling used everywhere else on the site. Past a small scroll threshold
 * (i.e. once the canvas-colored content below the hero is what's actually
 * behind the bar) it flips to a frosted-glass canvas background with the
 * normal dark text, same as before.
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

  // Only "light" (white-on-dark) at the very top, with the menu closed —
  // any time the frosted canvas background is showing instead, text goes
  // back to the normal dark-on-light styling used everywhere else.
  const light = !scrolled && !menuOpen;

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
          className={`-translate-y-[2px] font-display text-lg font-medium leading-none transition-colors duration-300 sm:text-xl ${
            light ? "text-white" : "text-brown-900"
          }`}
        >
          RadianceLaser
        </Link>

        <nav
          className={`hidden items-center justify-center gap-6 text-sm font-medium leading-none transition-colors duration-300 md:flex ${
            light ? "text-beige-300" : "text-brown-600"
          }`}
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`group relative py-1 transition-colors ${light ? "hover:text-gold-400" : "hover:text-gold-600"}`}
            >
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
            className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-300 md:hidden ${
              light ? "text-white hover:bg-white/10" : "text-brown-700 hover:bg-brown-900/5"
            }`}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link
            href="/login"
            className={`whitespace-nowrap text-sm font-medium leading-none transition-colors duration-300 ${
              light ? "text-beige-200 hover:text-gold-400" : "text-brown-700 hover:text-gold-600"
            }`}
          >
            Log In
          </Link>
          <Link
            href="/signup"
            className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold leading-none transition-all duration-150 active:scale-95 sm:px-4 sm:text-sm ${
              light ? "bg-gold-500 text-brown-900 hover:bg-gold-400" : "bg-brown-900 text-beige-200 hover:bg-gold-600"
            }`}
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
