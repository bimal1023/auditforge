import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#F5F3FF",
          100: "#EDE9FE",
          200: "#DDD6FE",
          300: "#C4B5FD",
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#7C3AED",
          700: "#6D28D9",
          800: "#5B21B6",
          900: "#4C1D95",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
        serif: ["Instrument Serif", "Georgia", "serif"],
      },
      animation: {
        "af-pulse":      "af-pulse 1.1s ease-in-out infinite",
        "af-pulse-ring": "af-pulse-ring 1.8s ease-out infinite",
        "af-shimmer":    "af-shimmer 1.8s ease-in-out infinite",
        "af-marquee":    "af-marquee 60s linear infinite",
        "af-bar":        "af-bar 0.8s linear infinite",
        "af-slide-in":   "af-slide-in 0.25s ease-out",
        "af-dot-1":      "af-dot 1.2s infinite 0s",
        "af-dot-2":      "af-dot 1.2s infinite 0.2s",
        "af-dot-3":      "af-dot 1.2s infinite 0.4s",
      },
    },
  },
  plugins: [],
};

export default config;
