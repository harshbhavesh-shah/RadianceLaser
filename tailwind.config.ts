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
          700: "#4A342A",
          600: "#6B5544",
          400: "#9C8672",
        },
        beige: {
          300: "#E8DDC9",
          200: "#F0E8D9",
        },
        gold: {
          600: "#8C6A24",
          500: "#A9812F",
          100: "#F3E7CC",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-inter)", "sans-serif"],
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
