import {defineConfig} from "@playwright/test";
import config from "./playwright.u01.config";
export default defineConfig({...config,testMatch:['tp01-integration.spec.ts']});
