import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Match the phase-one apps in pnpm-workspace.yaml; Desktop is phase two.
    include: ["apps/website/tests/**/*.test.{ts,tsx}", "apps/terminal/tests/**/*.test.{ts,tsx}", "packages/**/tests/**/*.test.{ts,tsx}", "tests/contract/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["apps/website/src/**/*.ts", "apps/terminal/src/**/*.ts", "packages/**/src/**/*.ts"],
      exclude: [
        // Vitest 4 remaps imported TSX modules into the coverage report.
        // Preserve the existing TypeScript logic scope of this Gate.
        "**/*.tsx",
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
