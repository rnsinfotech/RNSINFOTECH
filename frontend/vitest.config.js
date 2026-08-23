import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    globals: true,
    // apiRequest() throws at import time if this isn't set (see
    // src/lib/api.js) — tests that import it (directly or transitively
    // through a component) need a value present before that import runs.
    env: {
      VITE_API_BASE_URL: "http://localhost:4000/api",
    },
  },
});
