import {defineConfig} from '@playwright/test';
import config from './playwright.frontend-g8.config';
export default defineConfig({...config,testMatch:['x06-integration.spec.ts'],maxFailures:1});
