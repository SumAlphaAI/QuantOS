import {defineConfig} from "@playwright/test";
import config from "./playwright.u01.config";
export default defineConfig({...config,testMatch:['r1-integration.spec.ts'],timeout:60000});
