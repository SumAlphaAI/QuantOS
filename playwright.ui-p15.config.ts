import { defineConfig } from "@playwright/test";
import config from "./playwright.config";
export default defineConfig({ ...config, testIgnore: [], testMatch: ["ui-p15.spec.ts", "ui-p15-http.spec.ts", "ui104-bff.spec.ts", "ui104-settings.spec.ts"] });
