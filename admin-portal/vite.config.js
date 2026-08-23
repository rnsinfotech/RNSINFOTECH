import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standalone admin app — same build tool as the storefront (RNS INFOTECH
// frontend), but its own Vite project, its own dependency tree, and its
// own deploy target. It is never bundled into the customer site.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5174,
  },
  preview: {
    host: "0.0.0.0",
    port: 4174,
  },
  build: {
    sourcemap: false,
    target: "es2022",
  },
});
