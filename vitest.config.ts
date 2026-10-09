import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.spec.ts",
        "src/types.ts", // Type definitions only
        "node_modules/**",
        "dist/**",
      ],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      thresholds: {
        branches: 90,
        functions: 80,
        lines: 90,
        statements: 90,
      },
    },
    environment: "happy-dom",
    exclude: ["node_modules", "dist"],
    globals: true,
    include: ["src/**/*.{test,spec}.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
