import {defineConfig} from '@playwright/test';
import config from './playwright.config';
export default defineConfig({...config,testIgnore:[],testMatch:['ui603.spec.ts'],fullyParallel:false,retries:0,workers:1,use:{...config.use,ignoreHTTPSErrors:true,trace:'off'}});
