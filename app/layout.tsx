import type { Metadata } from "next";
import { Manrope, Michroma } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import NativeAppBridge from "@/components/native/NativeAppBridge";

// Default headline face everywhere (font-display, see tailwind.config.ts):
// the dashboard, /login, /signup, /contact, /compliance, and the landing
// page since its 2026-09-17 redesign. Also the body/sans face (font-sans)
// since the 2026-09-16 dashboard redesign — see tailwind.config.ts's
// fontFamily.sans comment — so weight 400 is loaded here too, not just the
// heading weights.
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700", "800"],
});

// The auth shell's own headline face (font-brand — see AuthShell.tsx,
// behind /login and /signup). No longer used by the landing page itself,
// which switched to plain Manrope in its 2026-09-17 redesign. Ships as a
// single 400 weight with no italic, so it's kept off body copy and dense
// UI even on the page that uses it.
const michroma = Michroma({
  subsets: ["latin"],
  variable: "--font-michroma",
  weight: "400",
});

// The wordmark in the auth panel and login/signup pages — the site
// header's own wordmark (components/marketing/SiteHeader.tsx) uses plain
// Manrope instead, not this. Self-hosted rather than pulled from next/font/google:
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
  title: "Lumière by Radiance",
  description: "Multi-tenant clinic management platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${michroma.variable} ${asimovian.variable}`}>
      <body className="bg-canvas font-sans text-brown-900 antialiased">
        <NativeAppBridge />
        {children}
      </body>
    </html>
  );
}
