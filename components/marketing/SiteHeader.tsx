"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

// Always "/#..." rather than a bare "#..." so these still work from a page
// other than home (e.g. /compliance) — clicking one navigates home and lets
// the browser's native hash-scroll take it from there.
const NAV_LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#security", label: "Security" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

/** Sticky site header, one visual state throughout. The old version
 * flipped between a light-on-dark style at rest and a dark-on-light style
 * once scrolled, tied to the home page's dark hero. The hero is gone, so
 * the header just stays dark-on-light everywhere, on every page — a plain
 * border and a solid canvas background instead of a mode switch. `forceSolid`
 * stays as a prop for callers, but it's now a no-op kept for compatibility. */
export default function SiteHeader({ forceSolid: _forceSolid = false }: { forceSolid?: boolean }) {
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
      className={`sticky top-0 z-50 border-b bg-canvas/90 backdrop-blur-md transition-shadow duration-200 ${
        scrolled || menuOpen ? "border-beige-300 shadow-soft" : "border-transparent"
      }`}
    >
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="font-logo text-lg tracking-tight text-brown-900 sm:text-xl">
          Radiance <span className="text-gold-600">Laser</span>
        </Link>

        <nav className="hidden items-center justify-center gap-7 text-sm font-medium text-brown-600 md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-brown-900">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="flex h-9 w-9 items-center justify-center rounded-md text-brown-700 transition-colors hover:bg-brown-900/5 md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link
            href="/login"
            className="hidden whitespace-nowrap text-sm font-medium text-brown-700 transition-colors hover:text-brown-900 sm:block"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="whitespace-nowrap rounded-md bg-brown-900 px-3 py-2 text-xs font-semibold text-beige-100 transition-colors hover:bg-gold-600 sm:px-4 sm:text-sm"
          >
            <span className="sm:hidden">Start trial</span>
            <span className="hidden sm:inline">Start free trial</span>
          </Link>
        </div>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-beige-300 px-4 py-3 text-sm font-medium text-brown-700 md:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-md px-2 py-2 transition-colors hover:bg-brown-900/5 hover:text-brown-900"
            >
              {link.label}
            </a>
          ))}
          <Link href="/login" onClick={() => setMenuOpen(false)} className="rounded-md px-2 py-2 hover:bg-brown-900/5">
            Log in
          </Link>
        </nav>
      )}
    </header>
  );
}
