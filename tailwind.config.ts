import type { Config } from "tailwindcss";

// Layout language after peregrineclothing.co.uk; type from FID & Co. (Nohemi + Satoshi).
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FFFFFF",
        surface: "#FFFFFF",
        sunk: "#F3F2EE",
        ink: "#191710",
        muted: "#686868",
        grey: "#AEAEAE",
        rule: "#E4E2DC",
        accent: { DEFAULT: "#222A41", deep: "#161C2E", soft: "#E7E9EF" },
        mustard: { DEFAULT: "#DBAE49", soft: "#F6EDD5" },
        good: { DEFAULT: "#2E6B4F", soft: "#E3EFE8" },
        warn: { DEFAULT: "#8A6414", soft: "#F6EDD5" },
        bad: { DEFAULT: "#A8322A", soft: "#F7E3E1" },
      },
      fontFamily: {
        display: ['"Nohemi"', '"Satoshi"', "system-ui", "sans-serif"],
        sans: ['"Satoshi"', '"Segoe UI"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "Consolas", "monospace"],
      },
      letterSpacing: {
        label: "0.08em",
        brand: "0.2em",
        tightest: "-0.035em",
      },
      keyframes: {
        rise: { from: { opacity: "0.001", transform: "translateY(10px)" }, to: { opacity: "1", transform: "none" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
      },
      animation: {
        rise: "rise .6s cubic-bezier(.2,.7,.2,1) both",
        marquee: "marquee 38s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
