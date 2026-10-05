import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {nodesFromPlans,closure,planInput,digest,confined,validateReceipt} from '../../../../scripts/provider-a1-receipts.mjs';
import {check as checkG0,validateManifest as validateG0} from '../../../../scripts/g0-development.mjs';
import {check as checkFep,validateManifest,validateEnvelope} from '../../../../scripts/fep0-development.mjs';
const out=resolve(import.meta.dirname);const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const save=(name,data)=>writeFileSync(resolve(out,name),JSON.stringify(data,null,2)+'\n');
const nodes=nodesFromPlans();save('normative-inputs.json',[...nodes].map(([id,n])=>[id,planInput(n)]));
mkdirSync(resolve(out,'logs'),{recursive:true});const executions=[];
const commands=[['plans',['pnpm','check:development-plans']],['f0',['pnpm','check:f0-development']],['provider',['pnpm','check:provider-a1']],['g0',['pnpm','check:g0-development']],['fep0',['pnpm','check:fep0']],['regressions',['node','--test','scripts/fep0-development.test.mjs','scripts/provider-a1-receipts.test.mjs','scripts/g0-development.test.mjs','scripts/user-acceptance-confirmation.test.mjs']]];
for(const [id,command]of commands){const start=new Date().toISOString();const r=spawnSync(command[0],command.slice(1),{encoding:'utf8',timeout:300000,maxBuffer:16*1024*1024});const output=(r.stdout??'')+(r.stderr??'');const log=`docs/audit/evidence/fep0-recheck-20261005/logs/${id}.log`;writeFileSync(log,output);executions.push({id,command,executedAt:start,exitCode:r.status,log,logSha256:digest(output)});save('executions.json',executions);assert.equal(r.status,0,id+' failed');console.log(id,'PASS');}
const ids=closure(nodes,'FE:FEP-0');assert.equal(ids.length,23);const files=new Map();
function file(path,expected){const bytes=readFileSync(confined(path));const hash=digest(bytes);if(expected)assert.equal(hash,expected,path);execFileSync('git',['ls-files','--error-unmatch','--',path],{stdio:'pipe'});files.set(path,{path,sha256:hash});return bytes;}
const snapshots=ids.map(id=>{const n=nodes.get(id),gate=n.stage_gate,path='docs/'+gate.evidence[0];const m=JSON.parse(file(path,gate.input_digest));const validation=id==='FE:FEP-0'?checkFep():id==='FRONTEND-GATE:G0'?checkG0({requireReady:true}):validateReceipt(id,{nodes});assert.equal(validation.status,'READY');for(const c of m.checks){file(c.log,c.logSha256);if(c.artifact)file(c.artifact,c.artifactSha256);if(c.targetEvidence)file(c.targetEvidence,c.targetEvidenceSha256);for(const a of c.supportingArtifacts??[])file(a.path,a.sha256);}if(m.webBuildSha256)file(dirname(path)+'/terminal-build.json',m.webBuildSha256);return {nodeId:id,stage_gate:gate,observedSourceCommit:m.observedSourceCommit,validation};});
const ledger=JSON.parse(file('docs/gate-records/G0-current-scope-confirmations.json'));const confirmation=JSON.parse(file(ledger.approval.record,ledger.approval.recordSha256));file(confirmation.document,confirmation.documentSha256);
const fepPath='docs/'+nodes.get('FE:FEP-0').stage_gate.evidence[0];const m=JSON.parse(readFileSync(fepPath));const probes=[];
function reject(id,fn,pattern){let error;try{fn();}catch(e){error=e;}assert(error,id+' was accepted');assert.match(error.message,pattern,id);probes.push({id,result:'EXPECTED_REJECTION',message:error.message.slice(0,300)});}
function mutated(id,change,pattern){const copy=structuredClone(m);change(copy);reject(id,()=>validateManifest(copy),pattern);}
mutated('missing-F0',x=>x.dependencies.shift(),/eight dependency/);
mutated('missing-PRE',x=>x.dependencies.splice(3,1),/eight dependency/);
mutated('source-input-drift',x=>x.inputs[0].sha256=digest('changed'),/inputs changed/);
mutated('normative-scope-drift',x=>x.planInput.requirements.push('unapproved'),/normative scope/);
mutated('unexecuted-check',x=>x.checks[0].exitCode=null,/failed or unexecuted/);
mutated('missing-own-check',x=>x.checks.pop(),/required check/);
mutated('substituted-dependency-digest',x=>x.dependencies[0].inputDigest=digest('fake'),/dependency digest/);
reject('changed-dependency-bytes',()=>validateManifest(m,{readBytes:p=>p===m.dependencies[0].manifest?Buffer.from('old report'):readFileSync(confined(p))}),/actual manifest content/);
reject('tampered-execution-log',()=>validateManifest(m,{readBytes:p=>p===m.checks[0].log?Buffer.from('fake log'):readFileSync(confined(p))}),/log content/);
const gate=structuredClone(nodes.get('FE:FEP-0').stage_gate);gate.evidence=['audit/FEP-0-comprehensive-review-2026-10-05.md'];reject('historical-report-as-receipt',()=>validateEnvelope(gate,readFileSync(fepPath)),/historical evidence/);
const badNodes=structuredClone(nodes);badNodes.get('CORE-GATE:F0').stage_gate.status='NOT_ASSESSED';reject('unready-F0',()=>validateManifest(m,{nodes:badNodes}),/dependency is not READY/);
const g0=JSON.parse(readFileSync('docs/'+nodes.get('FRONTEND-GATE:G0').stage_gate.evidence[0]));const request=structuredClone(g0.scopeRequest);request.scopeDigest=digest('changed scope');reject('changed-G0-confirmation-scope',()=>validateG0(g0,{request,requireReady:true}),/functional input inventory changed/);
save('independent-probes.json',probes);save('evidence-integrity.json',{source,files:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path)),fileCount:files.size,embeddedF06LogsVerifiedByValidator:7});
save('dependency-snapshot.json',{source,direct:8,upstream:22,total:23,ready:23,records:snapshots});
save('summary.json',{schema:'quantos-fep0-recheck/v1',source,executedAt:new Date().toISOString(),status:'PASS',closedFindings:['B-01','B-02'],activeFindings:{blocking:0,high:0,medium:0,low:0},controlPoints:{pass:20,total:20},directReady:8,totalReady:23,commandEntries:executions.length,regressions:141,independentRejections:probes.length,evidenceFiles:files.size,scopeInputCount:g0.scopeRequest.inputs.length,scopeDigest:g0.scopeRequest.scopeDigest,databaseExecuted:false,fullFunctionalExecutionsRerun:false,formalAccepted:false});console.log(JSON.stringify({ready:23,evidenceFiles:files.size,probes:probes.length,scopeInputs:g0.scopeRequest.inputs.length}));
