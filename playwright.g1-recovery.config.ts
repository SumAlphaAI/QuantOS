import {defineConfig} from "@playwright/test";
import config from "./playwright.config";
export default defineConfig({...config, testIgnore: [], testMatch: ["g1-recovery.spec.ts"], fullyParallel: false, retries: 0, workers: 1});
