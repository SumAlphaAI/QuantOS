import {defineConfig} from '@playwright/test';
import config from './playwright.frontend-g7.config';
export default defineConfig({...config,testMatch:['x3-integration.spec.ts'],maxFailures:1});
