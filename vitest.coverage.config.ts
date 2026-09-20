import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Match the phase-one apps in pnpm-workspace.yaml; Desktop is phase two.
    include: ["apps/website/tests/**/*.test.ts", "apps/terminal/tests/**/*.test.ts", "packages/**/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      all: true,
      include: ["apps/website/src/**/*.ts", "apps/terminal/src/**/*.ts", "packages/**/src/**/*.ts"],
      exclude: [
        "**/dist/**",
        "**/*.d.ts",
        "packages/api-client/src/gen/**",
      ],
      reporter: ["text", "json-summary"],
      thresholds: {
        lines: 80,
      },
    },
  },
});
