import {defineConfig} from "@playwright/test";
import config from "./playwright.config";
export default defineConfig({...config,testIgnore:[],testMatch:['frontend-g3.spec.ts','ui301.spec.ts','ui302.spec.ts','ui303.spec.ts','ui-p07.spec.ts'],fullyParallel:false,maxFailures:1,retries:0,workers:1,timeout:45000,use:{...config.use,ignoreHTTPSErrors:true,trace:'off'}});
