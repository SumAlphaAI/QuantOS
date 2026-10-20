import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';import YAML from 'yaml';import {operations,domains} from './provider-a5-contract.mjs';
const api=YAML.parse(fs.readFileSync('bff/openapi/quantos-bff.v1.yaml','utf8')),catalog=YAML.parse(fs.readFileSync('bff/page-operation-catalog.yaml','utf8'));
assert.match(api.info.version,/^1\.\d+\.\d+$/);assert(Number(api.info.version.split('.')[1])>=12);assert.equal(operations.length,58);assert.equal(new Set(operations).size,58);
assert.deepEqual(['C11','C14','C15','C16'].flatMap(c=>{assert.deepEqual(catalog.contracts[c].plannedOperations,[]);return catalog.contracts[c].publishedOperations}).sort(),[...operations].sort());
for(const id of operations){const op=Object.values(api.paths).flatMap(Object.values).find(o=>o.operationId===id);assert(op&&['BFF-FE-009','BFF-FE-008','BFF-FE-010'].includes(op['x-quantos-policy'].owner));assert(op.responses[401]&&op.responses[403]&&op.responses.default);}
for(const f of ['scripts/test-provider-a5-http.mjs',...domains.map(d=>d[1])])execFileSync(process.execPath,['--check',f],{stdio:'inherit'});
for(const f of ['scripts/check-bff-openapi.mjs','scripts/check-bff-contract-coverage.mjs','scripts/check-bff-compatibility.mjs'])execFileSync(process.execPath,[f],{stdio:'inherit'});
console.log('A5 boundary PASS: 58 C11/C14/C15/C16 operations; reference-only prerequisites; no ledger write or venue submission');
