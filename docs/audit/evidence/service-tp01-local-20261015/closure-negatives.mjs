// Probe the complete real frozen G index without modifying any canonical receipt.
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {validateLocalPrerequisites} from '../../../../scripts/provider-a1-receipts.mjs';
import {manifest,verify} from '../../../../scripts/service-tp01-local-gate.mjs';
const own=JSON.parse(readFileSync(manifest)),path=own.localPrerequisites.manifest,original=JSON.parse(readFileSync(path)),temporary=path.replace('/local-prerequisites.json','/negative-index.json');assert(!existsSync(temporary));after(()=>rmSync(temporary,{force:true}));
function fixture(mutate){const r=structuredClone(original);mutate(r);writeFileSync(temporary,JSON.stringify(r));return()=>validateLocalPrerequisites(temporary,{profile:'SERVICE-TP01_LOCAL'});}
test('complete frozen 31-node real index verifies',()=>assert.equal(fixture(()=>{})().nodes.length,31));
for(const[label,mutate]of[
 ['missing A',r=>r.nodes=r.nodes.filter(n=>n.nodeId!=='CORE:TP01-A')],['missing G',r=>r.nodes=r.nodes.filter(n=>n.nodeId!=='CORE:TP01-G')],
 ['missing E',r=>r.nodes=r.nodes.filter(n=>n.nodeId!=='CORE:TP01-E')],['missing F',r=>r.nodes.pop()],['missing R1 service',r=>r.nodes=r.nodes.filter(n=>n.nodeId!=='CORE-GATE:R1-SERVICE')],['missing R02',r=>r.nodes=r.nodes.filter(n=>n.nodeId!=='CORE:R02')],['duplicate node',r=>r.nodes[0]=r.nodes[1]],['mixed SHA',r=>r.observedSourceCommit='0'.repeat(40)],['wrong owner',r=>r.owner='CORE:TP01-G'],['old E schema',r=>r.schema='quantos-tp01-e-local-prerequisites/v1'],['E profile',r=>r.profile='TP01-E_LOCAL'],['database claim',r=>r.databaseExecution=true],['formal claim',r=>r.formalAccepted=true],['failed index',r=>r.status='FAIL'],['omitted target',r=>r.deferred.pop()],['promoted target',r=>r.deferred[0].status='PASS'],['manifest digest',r=>r.nodes[0].inputDigest='sha256:'+'0'.repeat(64)],['foreign manifest',r=>r.nodes[0].manifest='docs/audit/evidence/tp01-e-local-20261014/manifest.json'],
])test('real SERVICE closure rejects '+label,()=>assert.throws(fixture(mutate)));
for(const key of ['externalPublished','upstreamAccepted','targetCanaryAccepted','targetRollbackAccepted','formalAccepted','databaseExecution','performanceAccepted','externalExecution'])test('real SERVICE admission rejects '+key,()=>{const r=structuredClone(own);r[key]=true;assert.throws(()=>verify(r));});
test('real admission rejects removed target module obligation',()=>{const r=structuredClone(own);r.release.functionalTargets.shift();assert.throws(()=>verify(r));});

test('real service rejects coverage tampering',()=>{const r=structuredClone(own);r.coverage.workflowReplays=19;assert.throws(()=>verify(r));});
