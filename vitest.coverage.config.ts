import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["apps/**/tests/**/*.test.ts", "packages/**/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      all: true,
      include: ["apps/**/src/**/*.ts", "packages/**/src/**/*.ts"],
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
