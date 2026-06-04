import type { Config } from "tailwindcss";

// Tokens espelham DESIGN_SYSTEM.md (lidos de CSS vars em globals.css).
const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "var(--bg-base)",
        surface: {
          1: "var(--surface-1)",
          2: "var(--surface-2)",
          overlay: "var(--overlay)",
        },
        border: { DEFAULT: "var(--border)", strong: "var(--border-strong)" },
        content: {
          DEFAULT: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          amber: "var(--accent-amber)",
          magenta: "var(--accent-magenta)",
          soft: "var(--accent-soft)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: { sm: "6px", DEFAULT: "10px", lg: "14px" },
      backgroundImage: { "accent-grad": "var(--accent-grad)" },
      boxShadow: {
        overlay: "0 16px 48px rgba(0,0,0,.5)",
        glow: "0 0 0 1px var(--accent), 0 8px 24px rgba(255,107,53,.25)",
      },
      transitionTimingFunction: { out: "cubic-bezier(0.2,0,0,1)" },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in .18s cubic-bezier(0.2,0,0,1)",
        "slide-up": "slide-up .18s cubic-bezier(0.2,0,0,1)",
      },
    },
  },
  plugins: [],
};
export default config;
