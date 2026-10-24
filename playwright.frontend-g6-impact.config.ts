import { defineConfig } from '@playwright/test';
import config from './playwright.config';
export default defineConfig({ ...config, testIgnore: [], testMatch: ['ui-p23.spec.ts', 'ui601.spec.ts', 'ui602.spec.ts'], fullyParallel: false, retries: 0, workers: 1, use: { ...config.use, ignoreHTTPSErrors: true, trace: 'off' } });
