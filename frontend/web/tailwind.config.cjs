const baseDir = __dirname.replace(/\\/g, "/");

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("../design/tailwind.preset.cjs")],
  content: [
    `${baseDir}/index.html`,
    `${baseDir}/src/**/*.{js,ts,jsx,tsx}`,
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
