import type { Metadata } from "next";
import { Inter, Manrope, Michroma } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Default headline face everywhere except the landing page (font-display,
// see tailwind.config.ts): the dashboard, /login, /signup, /contact,
// /compliance. Kept as the site's "normal" heading type, with Michroma
// reserved for the landing page alone.
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["500", "600", "700", "800"],
});

// Landing-page-only headline face (font-brand — see app/page.tsx). Ships
// as a single 400 weight with no italic, so it's kept off body copy and
// dense UI even on the page that uses it.
const michroma = Michroma({
  subsets: ["latin"],
  variable: "--font-michroma",
  weight: "400",
});

// The wordmark only ("Radiance Laser" in the header, auth panel, and
// login/signup) — used everywhere, including the dashboard, unlike
// font-brand above. Self-hosted rather than pulled from next/font/google:
// this Next.js version's bundled Google Fonts metadata predates
// Asimovian's addition to the catalog, so next/font/google can't resolve
// it. The .woff2 (latin subset, weight 400, matching what Google Fonts
// itself serves) is fetched once and committed under app/fonts/.
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
    <html lang="en" className={`${inter.variable} ${manrope.variable} ${michroma.variable} ${asimovian.variable}`}>
      <body className="bg-canvas font-sans text-brown-900 antialiased">{children}</body>
    </html>
  );
}
