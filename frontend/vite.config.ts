import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development the FastAPI backend runs on :8000; proxy /api so the
// frontend can use same-origin relative URLs in every environment.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } },
  },
  build: {
    // Vendor chunks cache independently of app code between deploys.
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts", "react", "react-dom"],
          motion: ["gsap", "@gsap/react"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
