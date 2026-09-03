import type { Metadata } from "next";
import { Fraunces, Inter, Manrope } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Marketing-only headline face (public site: app/page.tsx and the shared
// SiteHeader). Kept separate from --font-fraunces, which the dashboard's
// font-display class still uses everywhere else in the app.
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "RadianceLaser",
  description: "Multi-tenant clinic management platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${manrope.variable}`}>
      <body className="bg-canvas font-sans text-brown-900 antialiased">{children}</body>
    </html>
  );
}
