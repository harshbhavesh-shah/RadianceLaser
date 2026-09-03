import type { Metadata } from "next";
import { Inter, Michroma } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Site-wide headline/brand face — every heading and every button, across
// both the dashboard (font-display) and the public site (font-brand). Both
// Tailwind tokens point at this one variable (see tailwind.config.ts) so
// every existing className stays valid.
//
// Michroma ships as a single 400 weight with no italic, so it's deliberately
// NOT used for body copy or dense UI (tables, form fields, receipts) — see
// font-sans/Inter below for that. Applying a wide, uppercase-styled display
// face to small dense text would hurt legibility rather than help it.
const michroma = Michroma({
  subsets: ["latin"],
  variable: "--font-michroma",
  weight: "400",
});

// The wordmark only ("Radiance Laser" in the header, auth panel, and
// login/signup) — kept as its own face (font-logo) rather than folded into
// font-brand/font-display above, so the logo can carry a distinct identity
// from the rest of the heading type. Self-hosted rather than pulled from
// next/font/google: this Next.js version's bundled Google Fonts metadata
// predates Asimovian's addition to the catalog, so next/font/google can't
// resolve it. The .woff2 (latin subset, weight 400, matching what Google
// Fonts itself serves) is fetched once and committed under app/fonts/.
const asimovian = localFont({
  src: "./fonts/Asimovian-Regular.woff2",
  variable: "--font-asimovian",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Radiance Laser",
  description: "Multi-tenant clinic management platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${michroma.variable} ${asimovian.variable}`}>
      <body className="bg-canvas font-sans text-brown-900 antialiased">{children}</body>
    </html>
  );
}
