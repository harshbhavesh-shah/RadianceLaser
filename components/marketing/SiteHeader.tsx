"use client";

import Image from "next/image";
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

/** Sticky site header, one visual state throughout — the sticky/scroll-
 * shadow behavior isn't part of the visual redesign (a static Figma export
 * has no scroll position to react to), it's a real UX pattern already
 * established here, kept as-is under the new colors/weights. `forceSolid`
 * stays as a prop for callers, but it's a no-op kept for compatibility. */
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
      className={`sticky top-0 z-50 bg-canvas/90 backdrop-blur-md transition-shadow duration-200 ${
        scrolled || menuOpen ? "shadow-soft" : ""
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-6 md:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="" width={28} height={28} className="rounded" />
          <span className="text-xl font-extrabold tracking-tight text-brown-900">Radiance Laser</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-extrabold text-brown-400 md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-brown-900">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-6">
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
            className="hidden whitespace-nowrap text-sm font-extrabold text-brown-900 transition-colors hover:text-brown-400 sm:block"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="whitespace-nowrap rounded-[16px] bg-rust-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-soft transition-colors hover:bg-rust-700 sm:px-5 sm:text-sm"
          >
            <span className="sm:hidden">Start trial</span>
            <span className="hidden sm:inline">Start Free Trial</span>
          </Link>
        </div>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-beige-300 px-6 py-3 text-sm font-extrabold text-brown-400 md:hidden">
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
          <Link
            href="/login"
            onClick={() => setMenuOpen(false)}
            className="rounded-md px-2 py-2 text-brown-900 hover:bg-brown-900/5"
          >
            Log in
          </Link>
        </nav>
      )}
    </header>
  );
}
