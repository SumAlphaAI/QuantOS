import assert from 'node:assert/strict';
import test from 'node:test';
import { ESLint } from 'eslint';
import { legacyNames } from './frontend-import-boundary.mjs';
const lint = new ESLint();
const diagnostics = async (code, filePath='apps/terminal/app/g0-probe/page.tsx') => (await lint.lintText(code,{filePath}))[0].messages.filter(m=>m.ruleId==='quantos-boundary/public-bff');
for(const name of legacyNames) test(`production rejects ${name}`,async()=>assert.equal((await diagnostics(`import { ${name} as Adapter } from '@sumalpha/api-client'; export const value = Adapter;`)).length,1));
for(const code of [
 "import * as api from '@sumalpha/api-client'; export const value = api;",
 "export * from '@sumalpha/api-client';",
 "export { InMemoryOpsBackend as Default } from '@sumalpha/api-client';",
 "export const value = import('@sumalpha/api-client');",
 "export const value = require('@sumalpha/api-client');",
 "import { value } from '../../../../crates/bff/src/db'; export {value};",
 "import { value } from '../tests/fixtures/backend'; export {value};",
 "export const value = import(globalThis.name);",
 "import { value } from '@sumalpha/api-client/src/terminal'; export {value};",
]) test(`production rejects bypass ${code}`,async()=>assert((await diagnostics(code)).length>0));
test('generated named public client imports are allowed',async()=>assert.equal((await diagnostics("import { createGeneratedBffClient } from '@sumalpha/api-client'; export const value = createGeneratedBffClient;")).length,0));
test('explicit test fixture adapters remain allowed',async()=>assert.equal((await diagnostics("import { InMemoryTerminalBackend } from '@sumalpha/api-client'; export const value = new InMemoryTerminalBackend();",'apps/terminal/tests/fixtures/g0-probe.ts')).length,0));
test('production src cannot hide behind a test-like filename',async()=>assert((await diagnostics("import { InMemoryOpsBackend } from '@sumalpha/api-client'; export const value = InMemoryOpsBackend;",'apps/terminal/src/bypass.test.ts')).length>0));
