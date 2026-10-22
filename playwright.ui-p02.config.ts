import { defineConfig } from "@playwright/test";
import config from "./playwright.config";
export default defineConfig({ ...config, testIgnore: [], testMatch: ["ui-p02.spec.ts", "ui101-bff.spec.ts", "ui-p02-http.spec.ts"] });
