import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths: the built site works from any folder, an IPFS gateway included.
  base: "./",
  worker: { format: "es" },
  build: { target: "es2022", chunkSizeWarningLimit: 4000 },
  optimizeDeps: { exclude: ["@zeryth/zeryth-engine"] },
});
