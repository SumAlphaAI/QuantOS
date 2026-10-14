// Supplementary audit of the freshly executed index; no canonical receipt is mutated.
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {validateLocalPrerequisites} from '../../../../scripts/provider-a1-receipts.mjs';
const attempt='docs/audit/evidence/provider-a1-remediation-20261004/tp01-e-local-20261014/attempt-05',original=JSON.parse(readFileSync(attempt+'/local-prerequisites.json'));
const temporary=attempt+'/negative-index.json';assert(!existsSync(temporary));after(()=>rmSync(temporary,{force:true}));
function fixture(mutate){const r=structuredClone(original);mutate(r);writeFileSync(temporary,JSON.stringify(r));return()=>validateLocalPrerequisites(temporary,{profile:'TP01-E_LOCAL'});}
test('fresh real 28-node index validates independently of publication',()=>{assert.equal(fixture(()=>{})().nodes.length,28);});
for(const[label,mutate]of[
 ['missing R1 service',r=>r.nodes=r.nodes.filter(n=>n.nodeId!=='CORE-GATE:R1-SERVICE')],
 ['missing E owner',r=>r.nodes.pop()],['duplicated node',r=>r.nodes[0]=r.nodes[1]],['missing R02',r=>r.nodes=r.nodes.filter(n=>n.nodeId!=='CORE:R02')],
 ['mixed source',r=>r.observedSourceCommit='0'.repeat(40)],['wrong profile',r=>r.profile='R1_LOCAL'],['wrong consumer',r=>r.owner='SERVICE:TP01'],['old schema',r=>r.schema='quantos-r1-local-prerequisites/v1'],
 ['database proof',r=>r.databaseExecution=true],['formal approval',r=>r.formalAccepted=true],['failed index',r=>r.status='FAIL'],['dropped release target',r=>r.deferred.pop()],['target promoted',r=>r.deferred[0].status='PASS'],
 ['changed manifest digest',r=>r.nodes[0].inputDigest='sha256:'+'0'.repeat(64)],['foreign manifest directory',r=>r.nodes[0].manifest='docs/audit/evidence/r03-20261011/manifest.json'],
])test('actual frozen closure rejects '+label,()=>assert.throws(fixture(mutate)));
