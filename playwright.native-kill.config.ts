import {defineConfig} from '@playwright/test';
import config from './playwright.config';
export default defineConfig({...config,testIgnore:[],testMatch:['native-kill-control.spec.ts','core-l4-off.spec.ts'],fullyParallel:false,retries:0,workers:1,use:{...config.use,ignoreHTTPSErrors:true,trace:'off'}});
