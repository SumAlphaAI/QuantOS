import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';
import {resolve,relative,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {root,digest,confined,inventory,nodesFromPlans,planInput,validateReceipt,publishStages} from './provider-a1-receipts.mjs';
import {executionSources} from './bff-fe-001-execution.mjs';
export const selectors=['services/bff-gateway/','crates/quantos-auth/','packages/api-client/','apps/terminal/src/auth/','apps/terminal/src/settings/','apps/terminal/tests/auth-bff.test.ts','apps/terminal/tests/ui104-settings.test.ts','bff/','supabase/migrations/20261003090000_bff_a2_identity_settings.sql','scripts/bff-fe-001*','scripts/check-bff-fe-001.mjs','scripts/test-bff-fe-001*','scripts/provider-a1-receipts.mjs','scripts/provider-a1-policy.json','scripts/generate-bff-contracts.mjs','Cargo.toml','Cargo.lock','package.json','pnpm-lock.yaml','Makefile','.github/workflows/frontend-baseline.yml'];
export const targetSourcePaths=['services/bff-gateway/src/live/settings.rs','services/bff-gateway/src/live/settings_policy.rs','services/bff-gateway/src/live.rs','crates/quantos-auth/src/lib.rs','supabase/migrations/20261003090000_bff_a2_identity_settings.sql','bff/openapi/quantos-bff.v1.yaml','scripts/test-bff-fe-001-live.mjs'];
export const targetAssertions=['audit-response-saveProfile','profile-replay-stable-correlation','audit-response-saveNotificationPrefs','primary-auth-timestamp','audit-response-mfa.verify','mfa-auth-timestamp','stale-first-factor-new-enrollment-denied','verified-enrollment-completed-replay','pending-existing-factor-recovery','pending-absent-factor-denied','verified-factor-overrides-cancel-checkpoint','audit-response-auth.reauth','revocation-event-correlation','audit-response-revokeSession'];
export const mutantNames=['last-factor-protection','csrf-enforcement','challenge-freshness','live-last-factor','live-first-factor-state','live-csrf','live-challenge-ttl','live-revocation'];
const expectedOperations=['getSession','getContext','reauth','mfaChallenge','logout','submitAccessRequest','getProfile','saveProfile','getNotificationPrefs','saveNotificationPrefs','getSecuritySettings','listSessions','revokeSession','subscribeSessionRevocations','listDevices','revokeDevice','setupMfa','revokeMfaFactor','listDownloads','getPlatformCapabilities'];
const sha=bytes=>digest(bytes).slice(7);
export function validateEvidence(m,{currentInputs,currentPlan,dependencies,read,validateDependency}) {
 assert.equal(m.schema,'quantos-bff-a2-development-manifest/v1');assert.equal(m.nodeId,'FE:BFF-FE-001');assert.equal(m.stage,'DEVELOPMENT');assert.equal(m.status,'PASS');assert.equal(m.formalAccepted,false);assert.deepEqual(m.residuals,[]);assert(/^[0-9a-f]{40}$/.test(m.observedSourceCommit),'source commit absent');assert(m.environment?.node&&m.environment?.rust&&m.environment?.target==='configured-supabase','execution environment absent');
 assert.deepEqual(m.inputs,currentInputs,'A2 functional inputs changed');assert.deepEqual(m.planInput,currentPlan,'A2 functional plan changed');
 assert.deepEqual(m.dependencies.map(d=>d.nodeId).sort(),[...dependencies.keys()].sort(),'dependency inventory differs');
 for(const d of m.dependencies){const n=dependencies.get(d.nodeId);assert.equal(n.status,'READY',`${d.nodeId}: not READY`);assert.equal(d.inputDigest,n.input_digest,'dependency receipt changed');validateDependency(d.nodeId);}
 const proofs=new Map();
 assert.deepEqual(m.checks.map(c=>c.id).sort(),['contract-negative','live','mutations','semantics','stage-negative','traces'].sort(),'missing executed evidence');
 for(const c of m.checks){assert.equal(c.status,'PASS');assert.equal(c.exitCode,0);const raw=read(c.path);assert.equal(digest(raw),c.sha256,'evidence content changed');assert(raw.length>0,'empty evidence');proofs.set(c.id,c.id==='traces'?raw.toString():c.id.endsWith('negative')?raw.toString():JSON.parse(raw));}
 const semantics=proofs.get('semantics');assert.equal(semantics.status,'PASS');assert.equal(semantics.results.length,3);assert(semantics.results.every(r=>r.exitCode===0));
 assert.deepEqual(semantics.results.map(r=>[r.command,r.args]),[['cargo',['test','--locked','--offline','-p','bff-gateway','--lib']],['cargo',['test','--locked','--offline','-p','bff-gateway','--test','auth_settings_provider']],['pnpm',['--filter','@sumalpha/terminal','exec','vitest','run','tests/auth-bff.test.ts','tests/ui104-settings.test.ts']]],'semantic commands differ');
 for(const [name,path]of Object.entries(executionSources))assert.equal(semantics.sourceHashes[name],currentInputs.find(i=>i.path===path)?.sha256.slice(7),`semantic proof stale ${name}`);
 for(const [index,r]of semantics.results.entries()){const raw=read(m.semanticLogs[index].path);assert.equal(sha(raw),r.outputSha256,'semantic log changed');assert(raw.includes('passed')||raw.includes('test result: ok'),'semantic assertions not executed');}
 const mutations=proofs.get('mutations');assert.equal(mutations.sourceSha256,currentInputs.find(i=>i.path==='services/bff-gateway/src/lib.rs').sha256.slice(7));assert.equal(mutations.livePolicySha256,currentInputs.find(i=>i.path.endsWith('/settings_policy.rs')).sha256.slice(7));assert.deepEqual(mutations.records.map(r=>r.name),mutantNames);
 for(const r of mutations.records){assert.equal(r.rejected,true);assert.notEqual(r.exitCode,0);const raw=read(m.mutationLogs.find(l=>l.name===r.name).path);assert.equal(sha(raw),r.outputSha256);assert(raw.includes(`${r.expectedTest} ... FAILED`),'mutation must fail business assertion');}
 const live=proofs.get('live');assert.equal(live.status,'PASS');assert.equal(live.failure,null);assert.equal(live.schema,'quantos-bff-a2-live-regression/v1');assert(live.scope.startsWith('configured existing Supabase Auth/PostgreSQL; local live BFF'));
 assert.deepEqual(live.assertions.slice().sort(),targetAssertions.slice().sort(),'target regression assertions missing');
 for(const [path,hash]of Object.entries(live.sourceHashes))assert.equal(hash,currentInputs.find(i=>i.path===path)?.sha256.slice(7),`target proof stale ${path}`);
 assert.deepEqual(Object.keys(live.sourceHashes).sort(),targetSourcePaths.slice().sort(),'target source inventory differs');for(const op of expectedOperations)assert(live.records.some(r=>r.operationId===op),'target operation not executed');assert(live.records.every(r=>!r.issues?.length),'target contract failed');
 assert.equal(live.cleanupVerified,true,'restoration not verified');
 const traces=proofs.get('traces').trim().split('\n').map(JSON.parse);assert(live.correlations.length>=5);for(const correlation of live.correlations)assert(traces.some(t=>t.correlation_id===correlation&&t.status==='succeeded'),'response/audit trace missing');
 for(const id of ['contract-negative','stage-negative'])assert(/# fail 0\b/.test(proofs.get(id)),'negative gate tests missing or failed');
 return {status:'READY',nodeId:m.nodeId,formalAccepted:false};
}
export function validateA2({nodes=nodesFromPlans(),base=root,record}={}) {
 const n=nodes.get('FE:BFF-FE-001');const gate=record??n.stage_gate;assert.equal(gate.status,'READY','A2 is not READY');assert.equal(gate.stage,'DEVELOPMENT');assert.equal(gate.evidence.length,1);
 const path='docs/'+gate.evidence[0];assert(path.startsWith('docs/audit/evidence/bff-fe-001-remediation-20261005/'),'A2 manifest outside evidence directory');const raw=readFileSync(confined(path,base));assert.equal(digest(raw),gate.input_digest,'A2 manifest digest changed');
 return validateEvidence(JSON.parse(raw),{currentInputs:inventory(selectors,base),currentPlan:planInput(n),dependencies:new Map(n.dependencies.map(id=>[id,nodes.get(id).stage_gate])),read:p=>readFileSync(confined(p,base)),validateDependency:id=>validateReceipt(id,{nodes,base})});
}
export function recordA2(output,targetDirectory='docs/audit/evidence/bff-fe-001-remediation-20261005/live') {
 assert(output?.startsWith('docs/audit/evidence/bff-fe-001-remediation-20261005/')&&!output.includes('..'),'unsafe output');
 assert(targetDirectory.startsWith('docs/audit/evidence/bff-fe-001-remediation-20261005/')&&!targetDirectory.includes('..'),'unsafe target evidence');const nodes=nodesFromPlans();const n=nodes.get('FE:BFF-FE-001');for(const id of n.dependencies)validateReceipt(id,{nodes});
 const checks=[];const add=(id,path)=>{const raw=readFileSync(confined(path));checks.push({id,path,sha256:digest(raw),exitCode:0,status:'PASS'});};
 mkdirSync(resolve(root,output),{recursive:true});
 for(const name of ['semantics.json','mutations.json'])cpSync(resolve(root,'artifacts/bff-fe-001',name),resolve(root,output,name));
 add('semantics',output+'/semantics.json');add('mutations',output+'/mutations.json');add('live',targetDirectory+'/receipt.json');add('traces',targetDirectory+'/traces.jsonl');
 add('contract-negative',output+'/contract-negative.log');add('stage-negative',output+'/stage-negative.log');
 const semanticLogs=[0,1,2].map(i=>{const name=`semantics-${i}.log`;cpSync(resolve(root,'artifacts/bff-fe-001',name),resolve(root,output,name));return {path:output+'/'+name};});
 const mutationLogs=mutantNames.map(name=>{const file=`mutation-${name}.log`;cpSync(resolve(root,'artifacts/bff-fe-001',file),resolve(root,output,file));return {name,path:output+'/'+file};});
 const m={schema:'quantos-bff-a2-development-manifest/v1',nodeId:n.id,stage:'DEVELOPMENT',status:'PASS',formalAccepted:false,residuals:[],excluded:['RELEASE staging/hosted CI/user acceptance','PROVIDER:A2/ALL and G1','P16 Desktop'],observedSourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),executedAt:new Date().toISOString(),environment:{node:process.version,rust:execFileSync('rustc',['--version'],{encoding:'utf8'}).trim(),platform:process.platform,target:'configured-supabase'},inputs:inventory(selectors),planInput:planInput(n),dependencies:n.dependencies.map(id=>({nodeId:id,inputDigest:nodes.get(id).stage_gate.input_digest})),checks,semanticLogs,mutationLogs};
 const path=output+'/a2.json';const bytes=JSON.stringify(m,null,2)+'\n';writeFileSync(resolve(root,path),bytes);n.stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:digest(bytes),evidence:[relative('docs',path)]};validateA2({nodes});
 const plan='docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md';writeFileSync(resolve(root,plan),publishStages(readFileSync(resolve(root,plan),'utf8'),nodes,'FE:'));return validateA2();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log(JSON.stringify(process.argv[2]==='--record'?recordA2(process.argv[3],process.argv[4]):validateA2()));}catch(e){console.error(e.message);process.exitCode=1;}}
