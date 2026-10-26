import {defineConfig} from "@playwright/test";
import config from "./playwright.config";
export default defineConfig({...config,testIgnore:[],testMatch:['u01-integration.spec.ts'],fullyParallel:false,maxFailures:1,retries:0,workers:1,timeout:45000,use:{...config.use,ignoreHTTPSErrors:true,trace:'off'}});
