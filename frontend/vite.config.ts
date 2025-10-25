import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tailwind + React barebones configuration
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
