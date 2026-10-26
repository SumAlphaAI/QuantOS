import {defineConfig} from "@playwright/test";
import config from "./playwright.frontend-g3.config";
export default defineConfig({...config,testMatch:["s04-integration.spec.ts"]});
