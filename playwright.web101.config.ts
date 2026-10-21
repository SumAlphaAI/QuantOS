import { defineConfig } from "@playwright/test";
import website from "./playwright.website.config";
export default defineConfig({ ...website, testMatch: ["website.spec.ts", "web101-current.spec.ts"], retries: 0, fullyParallel: false });
