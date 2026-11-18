/** @type {import('tailwindcss').Config} */
// Design tokens live here and in src/index.css (CSS variables). See docs/DESIGN_SYSTEM.md.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: "#f6f5f1", 2: "#efede7", 3: "#e6e3db" },
        ink: { DEFAULT: "#0f0f0f", 2: "#3d3c39", 3: "#6b6963", mute: "#8b8880" },
        line: "rgba(15,15,15,0.10)",
        night: { DEFAULT: "#0c0c0d", 2: "#161617", text: "#f2f1ec", mute: "#9a988f" },
        series: { portfolio: "#2a78d6", benchmark: "#8b8880" },
        gain: "#0b6e3a",
        loss: "#b63a2b",
        accent: "#2a78d6",
      },
      fontFamily: {
        sans: ['"Inter Tight"', "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
        serif: ['"Instrument Serif"', "Georgia", "serif"],
      },
      fontSize: {
        display: ["clamp(3.25rem, 9vw, 8.5rem)", { lineHeight: "0.92", letterSpacing: "-0.035em" }],
        headline: ["clamp(2.5rem, 5.6vw, 5rem)", { lineHeight: "0.98", letterSpacing: "-0.03em" }],
        title: ["clamp(1.75rem, 3vw, 2.5rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        statement: ["clamp(1.9rem, 4.2vw, 3.75rem)", { lineHeight: "1.12", letterSpacing: "-0.025em" }],
      },
      borderRadius: { DEFAULT: "6px", lg: "10px", xl: "14px" },
      maxWidth: { page: "1240px" },
      transitionTimingFunction: { out: "cubic-bezier(0.22, 1, 0.36, 1)" },
    },
  },
  plugins: [],
};
