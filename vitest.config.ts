import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    passWithNoTests: true,
    setupFiles: ["./src/tests/setup.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    include: [
      "src/shared/**/*.test.ts",
      "src/app/api/**/*.test.ts",
      "src/modules/**/*.test.ts",
    ],
  },
});
