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
test('generated named public client imports are allowed',async()=>assert.equal((await diagnostics("import { createBffClient } from '@sumalpha/api-client'; export const value = createBffClient;")).length,0));
test('explicit test fixture adapters remain allowed',async()=>assert.equal((await diagnostics("import { InMemoryTerminalBackend } from '@sumalpha/api-client'; export const value = new InMemoryTerminalBackend();",'apps/terminal/tests/fixtures/g0-probe.ts')).length,0));
test('production src cannot hide behind a test-like filename',async()=>assert((await diagnostics("import { InMemoryOpsBackend } from '@sumalpha/api-client'; export const value = InMemoryOpsBackend;",'apps/terminal/src/bypass.test.ts')).length>0));
test('shared frontend wrapper cannot re-export a legacy adapter under an alias',async()=>assert((await diagnostics("export { InMemoryTerminalBackend as RemoteClient } from '@sumalpha/api-client';",'packages/domain-ui/src/g0-proxy.ts')).length>0));
for(const module of ['pg','postgres','@supabase/supabase-js','@prisma/client','ccxt','@binance/connector']) test(`production rejects direct database or venue module ${module}`,async()=>assert((await diagnostics(`import { value } from '${module}'; export {value};`)).length>0));
test('registered Storybook data fixtures remain allowed',async()=>assert.equal((await diagnostics("import { value } from '../../fixtures/ui103'; export {value};",'packages/ui/src/components/DataGrid/g0.stories.tsx')).length,0));
test('runtime TerminalClient cannot instantiate a handwritten backend in production',async()=>assert((await diagnostics("import { TerminalClient } from '@sumalpha/api-client'; export { TerminalClient };")).length>0));
test('type-only legacy migration annotation does not create a production adapter',async()=>assert.equal((await diagnostics("import type { TerminalClient } from '@sumalpha/api-client'; export type Client = TerminalClient;")).length,0));
for(const extension of ['js','jsx','mjs','cjs']) test(`production boundary cannot be bypassed with ${extension}`,async()=>assert((await diagnostics("import { InMemoryOpsBackend } from '@sumalpha/api-client'; export const value = InMemoryOpsBackend;",`apps/terminal/src/g0-probe.${extension}`)).length>0));
test('production boundary cannot be disabled with an inline directive',async()=>assert((await diagnostics("/* eslint-disable quantos-boundary/public-bff */\nimport { InMemoryOpsBackend } from '@sumalpha/api-client'; export const value = InMemoryOpsBackend;")).length>0));
test('production cannot import repository database CLI internals',async()=>assert((await diagnostics("import { value } from '../../../../scripts/db-cli.cjs'; export {value};")).length>0));
