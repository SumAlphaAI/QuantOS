import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import YAML from 'yaml';
export const domains=[
 ['identity','scripts/test-bff-provider-contract.mjs',['--aggregate']],
 ['research','scripts/test-bff-fe-003-http.mjs',[]],
 ['market','scripts/test-bff-fe-005.mjs',[]],
 ['execution','scripts/test-bff-fe-006-http.mjs',[]],
 ['strategy','scripts/test-bff-fe-004-http.mjs',[]],
 ['reconciliation','scripts/test-bff-fe-009-http.mjs',[]],
 ['performance','scripts/test-bff-fe-008-http.mjs',[]],
 ['operations','scripts/test-bff-fe-010-http.mjs',[]],
 ['command','scripts/test-bff-fe-002-http.mjs',[]],
 ['platform','scripts/test-bff-fe-011-http.mjs',[]],
 ['assisted','scripts/test-provider-all-assisted-http.mjs',[]]
];
export function contract(read=p=>readFileSync(p)){
 const api=YAML.parse(read('bff/openapi/quantos-bff.v1.yaml').toString()),catalog=YAML.parse(read('bff/page-operation-catalog.yaml').toString());
 const generated=JSON.parse(read('tests/contract/generated/quantos-bff.operations.json').toString()),schemas=JSON.parse(read('tests/contract/generated/quantos-bff.components.schema.json').toString());
 const rows=[];for(const[path,item]of Object.entries(api.paths))for(const[method,op]of Object.entries(item))if(op?.operationId){const contracts=Object.entries(catalog.contracts).filter(([,c])=>c.publishedOperations.includes(op.operationId)).map(([id])=>id);assert.equal(contracts.length,1);rows.push({operationId:op.operationId,path,method:method.toUpperCase(),owner:op['x-quantos-policy'].owner,contract:contracts[0]});assert(op.responses.default);if(op.operationId==='submitAccessRequest')assert(op.responses[202]&&op.responses[422]&&op.responses[429]);else assert(op.responses[401]&&op.responses[403]);}
 // Validate the current generated contract by identity, rather than pinning an
 // older schema count/version that blocks every importing CI stage on upgrade.
 assert.equal(generated.version,api.info.version,'generated operation version differs from OpenAPI');
 const bindings=items=>items.map(({operationId,method,path})=>JSON.stringify([operationId,method,path])).sort();
 assert.deepEqual(bindings(rows),bindings(generated.operations),'generated operation bindings differ from OpenAPI');
 assert.deepEqual(Object.keys(api.components.schemas).sort(),Object.keys(schemas.$defs).sort(),'generated schema names differ from OpenAPI');
 assert.equal(schemas.$id,`https://quantos.sumalpha.ai/schemas/bff/${api.info.version}/components.json`);
 assert.equal(new Set(rows.map(r=>r.operationId)).size,rows.length,'duplicate OpenAPI operationId');
 const published=Object.values(catalog.contracts).flatMap(c=>c.publishedOperations);
 assert.deepEqual(published.slice().sort(),rows.map(r=>r.operationId).sort(),'published catalog operations differ from OpenAPI');
 assert.equal(Object.keys(catalog.contracts).length,17);assert(Object.values(catalog.contracts).every(c=>c.plannedOperations.length===0));
 assert.deepEqual([...new Set(rows.map(r=>r.owner))].sort(),Array.from({length:11},(_,i)=>`BFF-FE-${String(i+1).padStart(3,'0')}`));
 return rows.sort((a,b)=>a.operationId.localeCompare(b.operationId));
}
export const operations=contract().map(r=>r.operationId);
