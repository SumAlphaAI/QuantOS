import {defineConfig} from '@playwright/test';
import config from './playwright.config';
export default defineConfig({...config,testIgnore:[],testMatch:['core-l03.spec.ts','core-l03-off.spec.ts','g8-current.spec.ts','frontend-g8.spec.ts','fep5-function.spec.ts'],fullyParallel:false,retries:0,workers:1,use:{...config.use,ignoreHTTPSErrors:true,trace:'off'}});
