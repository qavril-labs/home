/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("../../design/tailwind.preset.cjs")],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
