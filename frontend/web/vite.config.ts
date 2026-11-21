import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  css: {
    postcss: path.resolve(__dirname, "./postcss.config.cjs"),
  },
  server: {
    port: Number(process.env.VITE_PORT || 5173),
    host: "127.0.0.1",
    strictPort: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
