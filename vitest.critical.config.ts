import { defineConfig } from "vitest/config";
import inventory from "./tests/critical-branches.json";

export default defineConfig({
  test: {
    include: ["packages/api-client/tests/**/*.test.ts", "packages/domain-ui/tests/**/*.test.{ts,tsx}", "packages/ui/tests/**/*.test.{ts,tsx}", "apps/terminal/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: inventory.files.map(entry => entry.path),
      exclude: [],
      reportsDirectory: "coverage/critical",
      reporter: ["text", "json-summary"],
      thresholds: { perFile: true, branches: 100, lines: 100, functions: 100, statements: 100 },
    },
  },
});
