import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateResponse} from '../tests/contract/http-contract.mjs';
import {validateFixture} from '../tests/contract/validate.mjs';
import {operations} from './bff-fe-003-development.mjs';
const probes=JSON.parse(readFileSync(process.argv[2]));
assert.deepEqual(probes.map(p=>p.operation).sort(),[...operations].sort());
for(const probe of probes){
 if(probe.operation==='subscribeResearchRun'){
  const frames=probe.body.sse.split('\n').filter(l=>l.startsWith('data: ')).map(l=>JSON.parse(l.slice(6)));assert(frames.length>0);
  for(const event of frames)assert.deepEqual(validateFixture(event,{schema:'StreamEvent'}),[]);
 }else{
  const correlation=probe.body.correlationId??'11111111-1111-4111-8111-111111111111';
  assert.deepEqual(await validateResponse(probe.operation,Response.json(probe.body,{status:probe.status,headers:{'X-Correlation-Id':correlation,'Cache-Control':'no-store'}})),[],probe.operation);
 }
}
console.log('BFF003 provider response schemas PASS: 9 operations; in-process reference fixture, no database acceptance.');
