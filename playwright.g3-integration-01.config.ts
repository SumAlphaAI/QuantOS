import {defineConfig} from "@playwright/test";
import config from "./playwright.frontend-g3.config";
export default defineConfig({...config,testMatch:["g3-integration-01.spec.ts"]});
