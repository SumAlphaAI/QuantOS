import { frontendBoundary } from "./scripts/frontend-import-boundary.mjs";
import nextPlugin from "@next/eslint-plugin-next";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Next also probes this configuration file when detecting the plugin.
  { plugins: { "@next/next": nextPlugin } },
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },
  {
    files: ["packages/api-client/src/gen/**/*.ts", "packages/api-client/src/bff-gen/**/*.ts"],
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
  {
    files: ["apps/website/**/*.{ts,tsx}", "apps/terminal/**/*.{ts,tsx}"],
    settings: { next: { rootDir: ["apps/website/", "apps/terminal/"] } },
    rules: {
      ...nextPlugin.configs.recommended.rules, ...nextPlugin.configs["core-web-vitals"].rules,
      "@next/next/no-async-client-component": "error",
      // These are App Router static exports with no pages/ directory.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    files: ["apps/terminal/{app,src}/**/*.{ts,tsx,js,jsx,mjs,cjs}", "apps/website/{app,src}/**/*.{ts,tsx,js,jsx,mjs,cjs}", "packages/{ui,domain-ui,platform,config}/src/**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    ignores: ["packages/ui/src/**/*.stories.{ts,tsx}"],
    linterOptions: { noInlineConfig: true },
    plugins: { "quantos-boundary": { rules: { "public-bff": frontendBoundary } } },
    rules: { "quantos-boundary/public-bff": "error" },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);
