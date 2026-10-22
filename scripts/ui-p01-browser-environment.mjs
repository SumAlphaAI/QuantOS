// Diagnose a browser executable independently from the product; never call this a functional PASS.
import { firefox } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import console from 'node:console';
const startedAt = new Date().toISOString();
let result;
try { const browser = await firefox.launch({ timeout: 10000 }); await browser.close(); result = { launch: 'PASS', functionalTests: 'NOT_RUN' }; }
catch (error) { result = { launch: 'FAILED', functionalTests: 'BLOCKED_ENVIRONMENT', errorName: error.name, error: error.message }; }
writeFileSync(process.argv[2], JSON.stringify({ schema: 'quantos-browser-environment/v1', browser: 'firefox', startedAt, ...result }, null, 2) + '\n');
console.log(JSON.stringify({ browser: 'firefox', launch: result.launch, functionalTests: result.functionalTests }));
