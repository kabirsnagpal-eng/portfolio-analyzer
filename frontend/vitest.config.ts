// Kept separate from vite.config.ts because vitest 2 bundles its own Vite major.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
