import type { Config } from "tailwindcss";

// Layout language after peregrineclothing.co.uk; type from FID & Co. (Nohemi + Satoshi).
// Colours are theme tokens (RGB channels in src/index.css), so light and dark swap in one place.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: token("paper"),
        surface: token("surface"),
        sunk: token("sunk"),
        ink: token("ink"),
        muted: token("muted"),
        grey: token("grey"),
        rule: token("rule"),
        chart: token("chart"),
        accent: { DEFAULT: token("accent"), deep: token("accent-deep"), soft: token("accent-soft") },
        mustard: { DEFAULT: token("mustard"), soft: token("mustard-soft") },
        good: { DEFAULT: token("good"), soft: token("good-soft") },
        warn: { DEFAULT: token("warn"), soft: token("warn-soft") },
        bad: { DEFAULT: token("bad"), soft: token("bad-soft") },
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
