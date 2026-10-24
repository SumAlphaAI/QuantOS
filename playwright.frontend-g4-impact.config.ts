import {defineConfig} from '@playwright/test';
import config from './playwright.config';
export default defineConfig({...config,testIgnore:[],testMatch:['ui-p18.spec.ts','ui-p19.spec.ts'],grep:/P18 actual overview|P18 per-venue failure|P18 selected quote feed|P19 actual reference shell|P19 transient same-scope|P19 viewer/,fullyParallel:false,retries:0,workers:1,use:{...config.use,ignoreHTTPSErrors:true,trace:'off'}});
