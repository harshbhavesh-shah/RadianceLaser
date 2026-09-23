import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // canvas/beige-300/brown-900/rust-* below match the exact hex
        // values from the Figma Make dashboard design (design/
        // DashboardOverviewDesign) as of the 2026-09-16 redesign pass —
        // update all four together if that reference ever changes, not
        // one at a time, since they're tuned to sit together (e.g.
        // rust-600 against canvas/surface specifically).
        canvas: "#FAF6F1",
        surface: "#FFFFFF",
        brown: {
          900: "#2C2A28",
          // A warmer, lighter espresso than 900 — the landing page hero's
          // dark ground. Reads as rich brown rather than near-black, on
          // purpose: it's a toned-down version of an earlier near-black
          // hero draft (see app/page.tsx).
          800: "#3D2C21",
          700: "#4A342A",
          600: "#6B5544",
          400: "#9C8672",
        },
        beige: {
          300: "#EAE5DE",
          200: "#F0E8D9",
          100: "#F7F0E3",
        },
        gold: {
          600: "#8C6A24",
          500: "#A9812F",
          400: "#C79A3E",
          100: "#F3E7CC",
        },
        // The rust-on-cream redesign's one accent — introduced for the
        // Dashboard page first (see app/dashboard/page.tsx), not yet used
        // anywhere else. Additive: brown/gold/beige above are untouched, so
        // every other page keeps its current look until it's redesigned too.
        rust: {
          700: "#A8543A",
          600: "#C1694F",
          100: "#F7E4DC",
        },
      },
      fontFamily: {
        // Default heading face everywhere, including the landing page as
        // of its 2026-09-17 redesign (see app/page.tsx) — the dashboard,
        // /login, /signup, /contact, /compliance, all of it.
        display: ["var(--font-manrope)", "sans-serif"],
        // Body text follows the Figma Make dashboard design, which uses
        // Manrope everywhere rather than pairing a separate body face —
        // same variable as font-display above, not a coincidence.
        sans: ["var(--font-manrope)", "sans-serif"],
        // The auth shell's own headline (AuthShell.tsx, behind /login and
        // /signup) — no longer used by the landing page itself, which
        // switched to plain font-display/Manrope in its 2026-09-17 redesign.
        brand: ["var(--font-michroma)", "sans-serif"],
        // The "Lumière by Radiance" wordmark in the auth shell only — see
        // app/layout.tsx. The site header's own wordmark (components/
        // marketing/SiteHeader.tsx) uses plain Manrope, not this.
        logo: ["var(--font-asimovian)", "sans-serif"],
      },
      boxShadow: {
        soft: "0 2px 12px -2px rgba(44, 29, 20, 0.08)",
        card: "0 4px 20px -4px rgba(44, 29, 20, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
