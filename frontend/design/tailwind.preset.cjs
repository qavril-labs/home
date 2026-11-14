// Tailwind preset for QAVRIL LABS. The web app (apps/web) uses this so classes map to the same tokens.
// Usage in tailwind.config: presets: [require("../../design/tailwind.preset.cjs")], and import design/tokens.css once.
// Colours point at the CSS variables, so light and dark themes switch without extra classes.
module.exports = {
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        page: "var(--q-page)",
        panel: "var(--q-panel)",
        cream: "var(--q-cream)",
        ink: "var(--q-ink)",
        text: "var(--q-text)",
        muted: "var(--q-muted)",
        grid: "var(--q-grid)",
        lime: "var(--q-lime)",
        pink: "var(--q-pink)",
        violet: "var(--q-violet)",
        cyan: "var(--q-cyan)",
        yellow: "var(--q-yellow)",
        orange: "var(--q-orange)",
        good: "var(--q-good)",
        watch: "var(--q-watch)",
        act: "var(--q-act)",
        idle: "var(--q-idle)",
        "series-in": "var(--q-series-in)",
        "series-out": "var(--q-series-out)",
        cash: "var(--q-cash)",
      },
      fontFamily: {
        display: ["Unbounded", "Arial Black", "system-ui", "sans-serif"],
        body: ["Space Grotesk", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Arial", "sans-serif"],
      },
      borderWidth: { line: "3px", thin: "2px" },
      borderRadius: { button: "14px", card: "0px" },
      boxShadow: {
        card: "8px 8px 0 var(--q-ink)",
        sm: "4px 4px 0 var(--q-ink)",
        hover: "11px 11px 0 var(--q-ink)",
      },
      maxWidth: { app: "1240px", modal: "560px", drawer: "480px" },
      transitionTimingFunction: { q: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    },
  },
};
