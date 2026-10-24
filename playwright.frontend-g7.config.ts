import {defineConfig} from '@playwright/test';
import config from './playwright.config';
export default defineConfig({...config,testIgnore:[],testMatch:['frontend-g7-paper.spec.ts','frontend-g7-shadow.spec.ts','fep5-function.spec.ts','frontend-g4.spec.ts','frontend-g6.spec.ts'],fullyParallel:false,retries:0,workers:1,use:{...config.use,ignoreHTTPSErrors:true,trace:'off'}});
