import assert from 'node:assert/strict';
import {stripVTControlCharacters} from 'node:util';
import {readFileSync,writeFileSync,existsSync,rmSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {root,digest,nodesFromPlans,planInput,publishStages,confined} from './provider-a1-receipts.mjs';
import {nodeId,profile,prerequisites,checks,snapshot} from './p0-functional-scope.mjs';
export {nodeId,profile};
export const manifest='docs/audit/evidence/p0-local-20261018/manifest.json';
export const scope={phase:'FUNCTION_DEVELOPMENT',recursiveDependencyRevalidation:false,wholeWorkspace:false,threeIndependentBuilds:false,dependencyAdmission:'NOT_CLAIMED'};
export const phases={functionImplementation:'PASS',businessIntegration:'NOT_RUN',releaseAcceptance:'NOT_RUN'};
export const flags=['databaseExecution','formalAccepted','production','externalExecution','externalPublished','upstreamAccepted','performanceAccepted','syncApproved','targetCanaryAccepted','targetRollbackAccepted'];
export const handoff='P0_LOCAL仅放行A1功能开发；六PRE独立Gate及F01/F03/F05/F06未重新授予READY。完整页面/API业务联调、干净环境bootstrap、三浏览器跨平台矩阵、目标Supabase/OIDC/RLS、性能/长稳/部署与同SHA hosted CI及正式确认分别留INTEGRATION/RELEASE，不使用生产凭据。';
export const dependencies=()=>prerequisites.map(node=>({nodeId:node,status:'NOT_REVALIDATED',owner:nodeId,referenceOnly:true,coverage:'CURRENT_P0_FUNCTION_CHECKS'}));
export function verifySource(inputs,source){
 assert.match(source,/^[a-f0-9]{40}$/);assert.equal(execFileSync('git',['cat-file','-t',source],{cwd:root,encoding:'utf8'}).trim(),'commit');
 const bytes=execFileSync('git',['cat-file','--batch'],{cwd:root,input:inputs.inputs.map(i=>source+':'+i.path+'\n').join(''),maxBuffer:64*1024*1024});let offset=0;
 for(const input of inputs.inputs){const end=bytes.indexOf(10,offset);assert(end>=offset);const parts=bytes.subarray(offset,end).toString().split(' ');assert.equal(parts.length,3,'missing committed input '+input.path);assert.equal(parts[1],'blob');const size=Number(parts[2]);assert(Number.isSafeInteger(size)&&size>=0);offset=end+1;assert.equal(digest(bytes.subarray(offset,offset+size)),input.sha256,'uncommitted/source drift '+input.path);offset+=size;assert.equal(bytes[offset++],10);}assert.equal(offset,bytes.length);
 const plans=['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'].map(p=>execFileSync('git',['show',source+':'+p],{encoding:'utf8',maxBuffer:8*1024*1024}));const frozen=nodesFromPlans(plans);
 assert.deepEqual(inputs.normative,inputs.normative.map(r=>({nodeId:r.nodeId,planInput:planInput(frozen.get(r.nodeId))})),'plan normative input drift');
}
export function verify(r,{current=snapshot(),nodes=nodesFromPlans(),read=p=>readFileSync(confined(p)),sourceVerifier=verifySource}={}){
 assert.equal(r.schema,'quantos-p0-functional-development/v1');assert.equal(r.nodeId,nodeId);assert.equal(r.profile,profile);assert.equal(r.stage,'DEVELOPMENT');assert.equal(r.status,'READY');assert.equal(r.engineeringStatus,'PASS');assert.equal(r.admission,'A1_ONLY');assert.equal(r.runtimeAdmission,'DENIED');
 assert.deepEqual(r.scope,scope);assert.deepEqual(r.phases,phases);for(const flag of flags)assert.equal(r[flag],false);
 assert.deepEqual(nodes.get(nodeId).dependencies,prerequisites);assert.deepEqual(r.dependencies,dependencies());assert.deepEqual(r.inputs,current,'affected inputs changed');sourceVerifier(r.inputs,r.observedSourceCommit);
 assert.deepEqual(r.planInput,planInput(nodes.get(nodeId)));assert.match(r.attempt,/^docs\/audit\/evidence\/p0-local-[0-9]{8}\/function-attempt-[0-9]{2}$/);
 assert.equal(r.checks.length,checks.length);const logs=new Map();
 for(const [i,row]of r.checks.entries()){
  const expected=checks[i];for(const k of ['id','command','reason','timeoutMs'])assert.deepEqual(row[k],expected[k]);assert.equal(row.status,'PASS');assert.equal(row.exitCode,0);assert.equal(row.signal,null);assert.equal(row.errorCode,null);assert.equal(row.timedOut,false);
  assert(Number.isFinite(Date.parse(row.startedAt))&&Number.isFinite(Date.parse(row.completedAt)));assert(Number.isFinite(row.elapsedMs)&&row.elapsedMs>=0&&row.elapsedMs<=row.timeoutMs);assert.equal(row.log,r.attempt+'/logs/'+row.id+'.log');const bytes=read(row.log);assert.equal(digest(bytes),row.logSha256);assert(bytes.length>0);logs.set(row.id,stripVTControlCharacters(bytes.toString()));
 }
 for(const id of ['pre01-negative','pre02-negative','pre03-negative','pre04-negative','pre05-negative','pre06-negative','gate-tests','formal-gate-negative','plan-policy']){const log=logs.get(id),total=/tests (\d+)/.exec(log)?.[1],passed=/pass (\d+)/.exec(log)?.[1];assert(Number(total)>0&&total===passed,'actual Node cases missing '+id);assert(/fail 0\b/.test(log));}
 for(const id of ['config-unit','ui-unit','contract','critical-coverage'])assert(/Tests\s+\d+ passed/.test(logs.get(id)),'actual Vitest cases missing '+id);
 for(const id of ['pre01','pre02','pre04','pre06'])assert.equal(JSON.parse(logs.get(id)).status,'PASS');
 assert(logs.get('pre05').includes('env/staging.env.example'));assert(logs.get('generated').includes('Generated BFF 1.7.0: 70 operations, 62 schemas.'));assert(logs.get('a1-inventory').includes('70 published + 38 planned'));assert(logs.get('sabotage').includes('四类故意破坏均被门禁捕获'));
 const web=logs.get('web-poc'),lines=web.split('\n').filter(l=>l.startsWith('P0_WEB_POC='));assert.equal(lines.length,1);const poc=JSON.parse(lines[0].slice(11));assert.equal(poc.status,'PASS');assert.equal(poc.sourceCommit,r.observedSourceCommit);assert.deepEqual(poc.browsers,['chromium']);assert.equal(poc.storybook,'BUILT');assert.equal(poc.clientSecrets,'PASS');assert.equal(poc.externalPublished,false);assert.equal(poc.bootstrap,'NOT_RUN_EXISTING_LOCKED_DEPENDENCIES');assert.equal(poc.publicConfiguration.NEXT_PUBLIC_QUANTOS_ENV,'local-mock');assert.equal(poc.publicConfiguration.NEXT_PUBLIC_QUANTOS_MOCK_ENABLED,'true');assert.equal(poc.publicConfiguration.NEXT_PUBLIC_QUANTOS_DEFAULT_MODE,'paper');assert.equal(poc.publicConfiguration.NEXT_PUBLIC_QUANTOS_TERMINAL_ORIGIN,'http://localhost:3190');assert.equal(poc.publicConfiguration.NEXT_PUBLIC_QUANTOS_OIDC_REDIRECT_URI,'http://localhost:3190/auth/callback');assert.equal(poc.publicConfiguration.NEXT_PUBLIC_SITE_ORIGIN,'http://localhost:3196');assert(poc.elapsedMs<1800000);assert.match(poc.sourceInventoryDigest,/^sha256:[a-f0-9]{64}$/);
 assert.equal(poc.sourceInventoryDigest,digest(JSON.stringify(current.inputs.filter(i=>['apps/terminal/','apps/website/','packages/'].some(p=>i.path.startsWith(p))))),'PoC source inventory mismatch');
 for(const app of ['website','terminal']){assert.equal(poc.builds[app].app,app);assert.equal(poc.builds[app].buildId,app+'-'+r.observedSourceCommit);assert.equal(poc.builds[app].output,'export');assert.match(poc.builds[app].sourceDigest,/^[a-f0-9]{64}$/);}
 assert(web.includes('"built_route_checks": 2'));assert((web.match(/\d+ passed \(/g)??[]).length>=2,'actual Chromium PoC suites missing');
 assert.deepEqual(r.release,{checkpoint:'RELEASE-GATE:BETA',status:'NOT_RUN',handoff,prerequisiteChecks:[{id:'p0-target',command:['node','scripts/check-p0-acceptance.mjs','--candidate','FROZEN_RELEASE_SHA'],status:'NOT_RUN'}]});
 return {nodeId,profile,stageGate:'READY',admission:'A1_ONLY',checks:r.checks.length,phases,formalAccepted:false,runtimeAdmission:'DENIED',observedSourceCommit:r.observedSourceCommit,currentHeadAcceptance:'NOT_CLAIMED'};
}
export function buildReceipt(attempt,source,inputs,rows){return {schema:'quantos-p0-functional-development/v1',nodeId,profile,stage:'DEVELOPMENT',status:'READY',engineeringStatus:'PASS',admission:'A1_ONLY',runtimeAdmission:'DENIED',scope,phases,observedSourceCommit:source,inputs,planInput:planInput(nodesFromPlans().get(nodeId)),attempt,checks:rows,...Object.fromEntries(flags.map(f=>[f,false])),dependencies:dependencies(),release:{checkpoint:'RELEASE-GATE:BETA',status:'NOT_RUN',handoff,prerequisiteChecks:[{id:'p0-target',command:['node','scripts/check-p0-acceptance.mjs','--candidate','FROZEN_RELEASE_SHA'],status:'NOT_RUN'}]}};}
export function verifyPublished(){const nodes=nodesFromPlans(),g=nodes.get(nodeId).stage_gate;assert.equal(g.status,'READY');assert.deepEqual(g.evidence,[manifest.slice(5)]);const bytes=readFileSync(confined(manifest));assert.equal(digest(bytes),g.input_digest);return verify(JSON.parse(bytes),{nodes});}
export function publish(r,{validate=verify,read=p=>existsSync(p)?readFileSync(p,'utf8'):null,write=(p,b)=>{if(b===null)rmSync(p,{force:true});else{mkdirSync(dirname(p),{recursive:true});writeFileSync(p,b);}},after=verifyPublished}={}){
 validate(r);const nodes=nodesFromPlans(),bytes=JSON.stringify(r,null,2)+'\n';nodes.get(nodeId).stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:digest(bytes),evidence:[manifest.slice(5)]};const updates=new Map([[manifest,bytes]]);
 const plan='docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md';updates.set(plan,publishStages(read(plan),new Map([[nodeId,nodes.get(nodeId)]]),'FE:'));const before=new Map([...updates.keys()].map(p=>[p,read(p)]));
 try{for(const[p,b]of updates)write(p,b);return after();}catch(error){for(const[p,b]of before)write(p,b);throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert(process.argv.length===3);assert.equal(process.argv[2],'--ready','P0 target/integration/release remains NOT_RUN');console.log(JSON.stringify(verifyPublished(),null,2));}catch(error){console.error(error.message.split('\n')[0]);process.exitCode=2;}}
