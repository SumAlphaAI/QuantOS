import {defineConfig} from "@playwright/test";
import config from "./playwright.config";
export default defineConfig({...config,testIgnore:[],testMatch:["ui-p05.spec.ts","ui204.spec.ts"],fullyParallel:false,retries:0,workers:1,use:{...config.use,ignoreHTTPSErrors:true,trace:"off"}});
