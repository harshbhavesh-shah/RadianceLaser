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
        canvas: "#FBF8F3",
        surface: "#FFFFFF",
        brown: {
          900: "#2C1D14",
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
          300: "#E8DDC9",
          200: "#F0E8D9",
          100: "#F7F0E3",
        },
        gold: {
          600: "#8C6A24",
          500: "#A9812F",
          400: "#C79A3E",
          100: "#F3E7CC",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-inter)", "sans-serif"],
        // Public marketing site only — see app/page.tsx and SiteHeader.
        brand: ["var(--font-manrope)", "sans-serif"],
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
