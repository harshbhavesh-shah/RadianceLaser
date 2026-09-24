import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Instrument_Serif } from "next/font/google";

// Scoped to the landing page: app/page.tsx puts all three variable classes
// on its root element, so the rest of the site keeps Manrope. Geist comes
// from the official `geist` package because this Next.js version's bundled
// Google Fonts list predates it.
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

export const landingFontVariables = [GeistSans.variable, GeistMono.variable, instrumentSerif.variable].join(" ");
