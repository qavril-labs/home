import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/app/",
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Development only: the API's /v1 routes are forwarded, so the browser calls them on its own origin.
    proxy: {
      "/v1": {
        target: process.env.VITE_DEV_API ?? "http://localhost:3002",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
