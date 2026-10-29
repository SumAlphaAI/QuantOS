import {defineConfig} from '@playwright/test';
import config from './playwright.config';
export default defineConfig({...config,testIgnore:[],testMatch:['core-l4.spec.ts','core-x06-alert.spec.ts','core-l4-off.spec.ts','c11-activation.spec.ts','c11-activation-off.spec.ts','c11-activation-paper.spec.ts','native-kill-control.spec.ts'],fullyParallel:false,retries:0,workers:1,use:{...config.use,ignoreHTTPSErrors:true,trace:'off'}});
