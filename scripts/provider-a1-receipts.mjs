import {snapshot as engineSnapshot} from './lib/test-engine-processes.cjs';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,realpathSync,statSync,existsSync,mkdtempSync,cpSync,rmSync} from 'node:fs';
import {resolve,relative,sep,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {parseEnv} from 'node:util';
import {validateR1Artifact,r1SupportingPaths} from './r1-functional-artifacts.mjs';
import {validateF0Artifact} from './f0-functional-artifacts.mjs';
import {validatePlans} from './check-development-plans.mjs';
import {verify as verifyTp01CSkeleton} from '../engines/vibe-adapter/check-development.mjs';
import {verifyTp04} from '../engines/trading-agents/check-development.mjs';
import {verifyTp03} from '../engines/llmquant/check-development.mjs';
import {verifyTp02} from '../engines/rd-agent/check-development.mjs';
import {verifyAbsorption} from '../engines/vibe-adapter/check-absorption.mjs';
export const root=resolve(import.meta.dirname,'..');
export const digest=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
export const directory='docs/audit/evidence/provider-a1-remediation-20261004';
const require=createRequire(import.meta.url);
const readMeasurements=require('./f05-measurements.cjs');
const {validateDatabaseCleanup}=require('./lib/f06-database-fixtures.cjs');
const planPaths=['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'];
export function nodesFromPlans(texts=planPaths.map(p=>readFileSync(resolve(root,p),'utf8'))) {
 const tasks=validatePlans(...texts).tasks;
 const nodes=new Map(tasks.map(n=>[n.task_type==='CORE'?`CORE:${n.task_id}`:`FE:${n.task_id}`,n]));
 for(const text of texts)for(const block of text.matchAll(/```json\n([\s\S]*?)\n```/g)){const n=JSON.parse(block[1]);if(n.checkpoint_id)nodes.set(n.checkpoint_id,n);}
 for(const [id,n]of nodes){n.id=id;n.dependencies=n.depends_on.map(d=>d.includes(':')?d:`FE:${d}`);
  if(n.task_id){const text=texts[n.task_type==='CORE'?0:1];const start=text.indexOf(`<a id="task-${n.task_id.toLowerCase()}"></a>`);const end=text.indexOf('<a id=',start+10);n.requirements=text.slice(start,end<0?undefined:end).split('\n').filter(line=>/^- (需求描述|量化验收标准|集成验收标准|验收标准|完成标准|目标阶段与验收|验收重点|页面级完成标准|交付节点与放行条件|技术要求|交付物|阶段执行|验收边界)：/.test(line));assert(n.requirements.length>=2,`${id}: normative requirements missing`);}
 }
 return nodes;
}
export function closure(nodes,id='PROVIDER:A1',selected=new Set()) {
 if(selected.has(id))return [...selected];
 assert(nodes.has(id),`unknown dependency ${id}`);
 for(const dep of nodes.get(id).dependencies)closure(nodes,dep,selected);
 selected.add(id);return [...selected];
}
export function planInput(n) {
 // Lifecycle/evidence fields deliberately excluded: changing a gate receipt cannot hash itself.
 return Object.fromEntries(Object.entries(n).filter(([k])=>!['id','stage_gate','review_status','source_commit','evidence','development_status','review_conclusion','issues','fix_tracking','review_entry','review_model','index','offset'].includes(k)).sort(([a],[b])=>a.localeCompare(b)));
}
export function confined(path,base=root) {
 assert(typeof path==='string'&&!path.includes('\\')&&!path.includes('#')&&!path.includes(':')&&!path.startsWith('/')&&!path.split('/').includes('..'),'unsafe receipt path');
 const actual=realpathSync(resolve(base,path));assert(actual.startsWith(realpathSync(base)+sep)&&statSync(actual).isFile(),'receipt path escapes repository');return actual;
}
function matches(path,selector){if(selector.endsWith('/'))return path.startsWith(selector);if(!selector.includes('*'))return path===selector;return new RegExp('^'+selector.split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$').test(path);}
export function inventory(selectors,base=root) {
 const paths=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{cwd:base,encoding:'utf8',maxBuffer:32*1024*1024}).trim().split('\n'))].filter(p=>p&&selectors.some(s=>matches(p,s))).sort();
 for(const selector of selectors)assert(paths.some(p=>matches(p,selector)),`missing required input selector ${selector}`);
 return paths.map(path=>{
  const actual=realpathSync(resolve(base,path));assert(actual.startsWith(realpathSync(base)+sep),'input path escapes repository');
  if(statSync(actual).isDirectory()){
   const entry=execFileSync('git',['ls-files','--stage','--',path],{cwd:base,encoding:'utf8'}).trim();assert(/^160000 [a-f0-9]{40} 0\t/.test(entry),'input directory must be a tracked Git link');
   const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:actual,encoding:'utf8'}).trim();assert.equal(commit,entry.split(' ')[1],'third-party checkout differs from pinned Git link');assert.equal(execFileSync('git',['status','--porcelain'],{cwd:actual,encoding:'utf8'}).trim(),'','third-party checkout is dirty');
   return {path,role:'third-party',gitCommit:commit,sha256:digest('gitlink:'+commit)};
  }
  return {path,role:path.startsWith('bff/')||path.startsWith('proto/')?'contract':/test|fixture|negative|mutation/.test(path)?'test':/^env\/|^eslint\.config\.|\.(json|ya?ml|toml)$|lock$|Makefile|nvmrc|version$/.test(path)?'config':'code',sha256:digest(readFileSync(confined(path,base)))};
 });
}
export function captureInputs(nodes,selected,p=policy(),base=root) {
 return new Map(selected.map(id=>[id,{planInput:planInput(nodes.get(id)),inputs:inventory([...p.commonInputs,...p.nodes[id].inputs],base)}]));
}
export function assertInputSnapshot(before,after) {
 assert.deepEqual(after,before,'functional inputs changed during execution; rerun on committed source');
}
export function developmentEnvironment(template,overrides={},base=process.env) {
 const vars=parseEnv(template);
 assert([...Object.keys(vars),...Object.keys(overrides)].every(k=>k.startsWith('NEXT_PUBLIC_')),'development profile must contain public variables only');
 const privateEnv=Object.fromEntries(Object.entries(base).filter(([k])=>!k.startsWith('NEXT_PUBLIC_')));
 return {...privateEnv,...vars,...overrides,QUANTOS_CLIENT_PROFILE:'mock',QUANTOS_RUN_F09_POSTGRES_TESTS:'0'};
}
export function staticEnvironment(base) {
 const env={...base,QUANTOS_SKIP_ENV:'1'};for(const key of Object.keys(env))if(/DATABASE_URL|SUPABASE|QUANTOS_RUN_.*TESTS/.test(key))delete env[key];return env;
}
export function policy(base=root){return JSON.parse(readFileSync(resolve(base,'scripts/provider-a1-policy.json'),'utf8'));}
export function validateReproducibility(r,source) {
 assert.equal(r.schemaVersion,2);assert.equal(r.mode,'reproducibility');assert.equal(r.status,'PASS');assert.equal(r.passed,true);assert.equal(r.reproducible,true);assert.equal(r.source?.commit,source);assert.equal(r.source?.dirty,false);
 assert.equal(r.runs?.length,3,'three independent builds required');
 const expected=[['make',['bootstrap']],['cargo',['build','--workspace','--release','--locked']],['pnpm',['build']],['make',['build-python']]];
 for(const [index,run]of r.runs.entries()){assert.equal(run.run,index+1);assert.deepEqual(run.commands.map(c=>[c.binary,c.args]),expected,'full cross-language build commands required');assert(run.commands.every(c=>c.exitCode===0),'reproducible build command failed');
  assert(/^[0-9a-f]{64}$/.test(run.combinedSha256),'output digest missing');assert.equal(run.combinedSha256,r.runs[0].combinedSha256,'build digests differ');
  for(const output of [run.rust,run.python,...(run.typescript??[])]){assert(output?.files?.length>0,'build output inventory missing');for(const file of output.files)assert(/^[0-9a-f]{64}$/.test(file.sha256)&&file.sizeBytes>0,'built file digest missing');}
  assert(run.typescript?.length>0,'TypeScript outputs missing');const outputs={rust:run.rust,python:run.python,typescript:run.typescript};assert.equal(run.combinedSha256,createHash('sha256').update(JSON.stringify(outputs)).digest('hex'),'combined output digest mismatch');for(const output of [run.rust,run.python,...run.typescript])assert.equal(output.sha256,createHash('sha256').update(JSON.stringify(output.files)).digest('hex'),'file inventory digest mismatch');
 }
}
export function validateArtifact(kind,path,source) {
 const r=JSON.parse(readFileSync(path));
 if(kind==='f01-reproducibility')validateReproducibility(r,source);
 else if(kind==='tp04-development'){assert.equal(r.observedSourceCommit,source,'TP04 execution source differs');verifyTp04(r,{checkDependencies:false,logDirectory:dirname(path)});}
 else if(kind==='tp03-development'){assert.equal(r.observedSourceCommit,source,'TP03 execution source differs');verifyTp03(r,{checkDependencies:false,logDirectory:dirname(path)});}
 else if(kind==='tp02-development'){
  assert.equal(r.observedSourceCommit,source,'TP02 execution source differs');
  verifyTp02(r,{checkDependencies:false,logDirectory:dirname(path)});
 }
 else if(kind==='tp01-d-absorption'){
  assert.equal(r.observedSourceCommit,source,'TP01-D execution source differs');
  verifyAbsorption(r,{checkDependencies:false,logDirectory:dirname(path)});
 }
 else if(kind==='tp01-c-skeleton'){
  assert.equal(r.observedSourceCommit,source,'TP01-C execution source differs');
  verifyTp01CSkeleton(r,{checkDependencies:false,logDirectory:dirname(path)});
 }
 else if(kind==='f05-volume')readMeasurements(path,true);
 else if(kind==='f04-branch')execFileSync(process.execPath,[resolve(root,'scripts/check-f04-branch.mjs'),path],{encoding:'utf8'});
 else if(['r01-target','r02-target','r1-process-cleanup'].includes(kind))validateR1Artifact(kind,path,source);
 else validateF0Artifact(kind,path,source);
}
export function supportingArtifactPaths(kind,r) {
 if(kind==='tp04-development')return [...r.checks.map(c=>c.id+'.log'),...r.package.wheels.map(w=>'wheels/'+w.file),...r.outputs.map(x=>x.file)].sort();
 if(kind==='tp03-development')return [...r.checks.map(c=>c.id+'.log'),...r.package.wheels.map(w=>'wheels/'+w.file),...r.outputs.map(x=>x.file)].sort();
 if(kind==='tp02-development')return [...r.checks.map(c=>c.id+'.log'),...r.package.wheels.map(w=>'wheels/'+w.file)].sort();
 if(['tp01-c-skeleton','tp01-d-absorption'].includes(kind))return r.checks.map(c=>c.id+'.log').sort();
 if(['r01-target','r02-target'].includes(kind))return r1SupportingPaths(r);
 if(kind==='f09-target')return Object.keys(r.logs??{}).sort();
 if(kind==='f08-service')return ['installed-module.log',...r.cases.map(c=>c.log),'wheels/'+r.mockWheel.file].sort();
 if(kind==='f07-coverage')return ['coverage.json'];
 return [];
}
export function validateReceipt(id,{nodes=nodesFromPlans(),base=root,record,visited=new Set(),requireReady=true}={}) {
 if(visited.has(id))return;visited.add(id);
 const n=nodes.get(id);assert(n,`unknown receipt node ${id}`);const p=policy(base);const spec=p.nodes[id];assert(spec,`node outside A1 functional policy ${id}`);
 if(requireReady)assert.equal(n.stage_gate.status,'READY',`${id}: dependency is not READY`);
 const gate=record??n.stage_gate;assert.equal(gate.stage,'DEVELOPMENT');assert.equal(gate.evidence.length,1,'one functional manifest required');
 const path='docs/'+gate.evidence[0];assert(path.startsWith(directory+'/'),`${id}: functional manifest must be under approved evidence directory`);
 const bytes=readFileSync(confined(path,base));assert.equal(digest(bytes),gate.input_digest,`${id}: manifest digest mismatch`);
 const m=JSON.parse(bytes);assert.equal(m.schema,'quantos-stage-functional-manifest/v1');assert.equal(m.nodeId,id);assert.equal(m.stage,'DEVELOPMENT');assert.equal(m.status,'PASS');assert.equal(m.scope,spec.scope);assert.equal(m.formalAccepted,false);
 assert.deepEqual(m.residuals,[],'unresolved functional findings');assert.deepEqual(m.excluded,p.excluded);assert.deepEqual(m.planInput,planInput(n),'changed functional plan inputs');
 assert.deepEqual(m.inputs,inventory([...p.commonInputs,...spec.inputs],base),'source/contract/config/test inventory or content changed');
 assert(m.environment?.node&&m.environment?.pnpm&&m.environment?.rust&&m.environment?.platform,'execution environment missing');assert(/^[0-9a-f]{40}$/.test(m.observedSourceCommit),'execution source commit missing');
 assert.deepEqual(m.checks.map(c=>c.id).sort(),[...spec.checks].sort(),'required functional checks missing or extra');
 for(const c of m.checks){const check=p.checks[c.id];assert.deepEqual(c.command,check.command,'actual command differs from policy');assert.equal(c.exitCode,0,'failed or unexecuted check');assert.equal(c.status,'PASS');assert(Number.isFinite(Date.parse(c.executedAt))&&Date.parse(c.executedAt)<=Date.now(),'actual execution time missing');
  assert(c.log.startsWith(dirname(path)+'/logs/'),'log outside evidence directory');const log=readFileSync(confined(c.log,base));assert.equal(digest(log),c.logSha256,'log content changed');assert(log.length>0,'empty execution log');if(check.marker)assert(new RegExp(check.marker).test(log.toString()),`required execution marker missing ${c.id}`);
  if(check.database)assert.equal(c.target,'configured-supabase','actual database execution missing');
  if(check.transientDatabase){assert(Array.isArray(c.attempts)&&c.attempts.length>=1&&c.attempts.length<=check.maxAttempts,'database attempt outcomes missing');for(const [i,a]of c.attempts.entries()){assert.equal(a.attempt,i+1);if(i===c.attempts.length-1)assert.equal(a.exitCode,0);else {assert.notEqual(a.exitCode,0);assert.equal(a.transient,true,'semantic database failures cannot be retried');}}}
  if(check.env)assert.deepEqual(c.environmentOverrides,check.env,'required execution environment differs');
  if(check.reproducibility||check.measurement||check.artifact){assert(c.artifact?.startsWith(directory+'/'),'functional artifact missing');const artifact=confined(c.artifact,base);assert.equal(digest(readFileSync(artifact)),c.artifactSha256,'functional artifact changed');validateArtifact(check.reproducibility?'f01-reproducibility':check.measurement?'f05-volume':check.artifactKind,artifact,m.observedSourceCommit);if(check.artifactKind==='r1-process-cleanup')assert.equal(JSON.parse(readFileSync(artifact)).scopeTag,m.environment.engineProcessScope,'process cleanup ownership scope differs');const required=supportingArtifactPaths(check.artifactKind,JSON.parse(readFileSync(artifact)));assert.deepEqual((c.supportingArtifacts??[]).map(a=>a.path),required.map(p=>dirname(c.artifact)+'/'+p),'required supporting artifacts differ');for(const a of c.supportingArtifacts??[])assert.equal(digest(readFileSync(confined(a.path,base))),a.sha256,'supporting artifact content changed');}
  if(check.target){if(check.maxAttempts)assert(Array.isArray(c.attempts),'target attempt outcomes missing');if(c.attempts){assert(c.attempts.length>=1&&c.attempts.length<=(check.maxAttempts??1),'invalid target attempt count');for(const [index,attempt]of c.attempts.entries()){assert.equal(attempt.attempt,index+1);if(index===c.attempts.length-1)assert.equal(attempt.exitCode,0);else {assert.notEqual(attempt.exitCode,0);assert.equal(attempt.transient,true,'semantic failures cannot be retried');}}}assert.equal(c.target,'configured-supabase','target database execution required');assert(c.targetEvidence,'target receipt required');const raw=readFileSync(confined(c.targetEvidence,base));assert.equal(digest(raw),c.targetEvidenceSha256,'target receipt changed');const r=JSON.parse(raw);assert.equal(r.schema,'quantos-f06-target-acceptance/v2');assert.equal(r.status,'PASS');assert.equal(r.targetClass,'configured-test-supabase-local-services');assert.equal(r.sourceCommit,m.observedSourceCommit);assert.deepEqual(r.evidence.map(e=>e.name),['build','preflight','auth-bff','auth-runtime','execution','vault','database']);assert.deepEqual(r.failures,[]);for(const key of ['realOidcBff','executionRoleAndVault','denialMatrix'])assert.equal(r[key]?.status,'PASS');for(const e of r.evidence){assert.equal(e.exit_code,0);assert.equal(createHash('sha256').update(gunzipSync(Buffer.from(e.logGzipBase64,'base64'))).digest('hex'),e.logSha256,'target execution log digest mismatch');}validateDatabaseCleanup(r.databaseCleanup);for(const e of r.evidence){assert.equal(e.timedOut,false);assert.equal(e.errorCode,null);assert.equal(e.signal,null);assert(Number.isFinite(e.elapsedMs)&&e.elapsedMs>=0);assert.equal(e.timeoutMs,e.name==='database'?900000:300000);}assert.match(gunzipSync(Buffer.from(r.evidence.at(-1).logGzipBase64,'base64')).toString(),/8 passed; 0 failed/);}
 }
 assert.deepEqual(m.dependencies.map(d=>d.nodeId).sort(),[...n.dependencies].sort(),'dependency receipt inventory mismatch');
 for(const d of m.dependencies){const dep=nodes.get(d.nodeId);assert(dep&&dep.stage_gate.status==='READY',`unready dependency ${d.nodeId}`);assert.equal(d.inputDigest,dep.stage_gate.input_digest,'dependency receipt changed');assert.equal(d.manifest,'docs/'+dep.stage_gate.evidence[0]);validateReceipt(d.nodeId,{nodes,base,visited});}
 return {status:'READY',nodeId:id,inputDigest:gate.input_digest,formalAccepted:false};
}
export function publishStages(text,nodes,namespace) {
 return text.replace(/^- stage_gate: (\{.*\})$/gm,(block,raw,offset)=>{const task=[...text.slice(0,offset).matchAll(/^- task_id: `([^`]+)`/gm)].at(-1)?.[1];return nodes.has(namespace+task)?'- stage_gate: '+JSON.stringify(nodes.get(namespace+task).stage_gate):block;}).replace(/```json\n([\s\S]*?)\n```/g,(block,raw)=>{const data=JSON.parse(raw);if(!nodes.has(data.checkpoint_id))return block;data.stage_gate=nodes.get(data.checkpoint_id).stage_gate;return '```json\n'+JSON.stringify(data,null,2)+'\n```';});
}
export function runTargetAttempts(execute,maxAttempts=3) {
 assert(Number.isInteger(maxAttempts)&&maxAttempts>=1&&maxAttempts<=3,'target attempt budget must be between 1 and 3');
 const runs=[];
 for(let attempt=1;attempt<=maxAttempts;attempt++){
  const run=execute(attempt);run.transient=run.status!==0&&/(?:session handshake returned HTTP 503|BFF did not establish the real Auth session \(HTTP 503|operation was aborted due to timeout|F06 BFF preflight failed: Connection terminated unexpectedly(?:\r?\n|$))/.test(run.diagnostic??'');runs.push(run);
  if(run.status===0||!run.transient)break;
 }
 return runs;
}
export function runDatabaseAttempts(execute,maxAttempts=3) {
 assert(Number.isInteger(maxAttempts)&&maxAttempts>=1&&maxAttempts<=3,'database attempt budget must be between 1 and 3');const runs=[];
 for(let attempt=1;attempt<=maxAttempts;attempt++){const run=execute(attempt);run.transient=run.status!==0&&/Postgres\(Error \{ kind: Closed, cause: None \}\)/.test((run.stdout??'')+(run.stderr??''));runs.push(run);if(run.status===0||!run.transient)break;}return runs;
}
export function assess(outputDirectory=directory,rootIds=['PROVIDER:A1']) {
 const approvedDirectory='docs/audit/evidence/provider-a1-remediation-20261004';
 assert(outputDirectory===approvedDirectory || (outputDirectory.startsWith(approvedDirectory+'/') && /^[a-z0-9/-]+$/.test(outputDirectory) && !outputDirectory.includes('..')), 'unsafe assessment evidence directory');
 const directory=outputDirectory;
 assert.equal(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),'','commit source before recording functional execution');
 const texts=planPaths.map(p=>readFileSync(resolve(root,p),'utf8'));const nodes=nodesFromPlans(texts);const selected=[...new Set(rootIds.flatMap(id=>closure(nodes,id)))];const p=policy();const initialInputs=captureInputs(nodes,selected,p);const out=resolve(root,directory);assert(!existsSync(resolve(out,'execution-results.json')),'assessment evidence already exists; select a fresh directory');mkdirSync(resolve(out,'logs'),{recursive:true});
 const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();const environment={node:process.version,pnpm:execFileSync('pnpm',['--version'],{encoding:'utf8'}).trim(),rust:execFileSync('rustc',['--version'],{encoding:'utf8'}).trim(),platform:process.platform,clientProfile:'local-mock'};
 const priority=id=>p.checks[id].reproducibility?3:(p.checks[id].target||p.checks[id].cleanSource)?2:0;const all=[...new Set(selected.flatMap(id=>p.nodes[id].checks))].sort((a,b)=>priority(b)-priority(a));const results=new Map();const deferred=[];
 const engineBaselineDir=all.some(id=>p.checks[id].artifactKind==='r1-process-cleanup')?mkdtempSync(resolve(tmpdir(),'quantos-r1-engine-scope-')):null;
 const engineBaseline=engineBaselineDir?resolve(engineBaselineDir,'baseline.json'):null;
 const engineScope=engineBaseline?randomBytes(4).toString('hex'):null;
 if(engineBaseline){environment.engineProcessScope=engineScope;writeFileSync(engineBaseline,JSON.stringify({...engineSnapshot(root),scopeTag:engineScope}));}
 for(const id of all){const spec=p.checks[id];const env=developmentEnvironment(readFileSync(confined(p.developmentProfile.file),'utf8'),p.developmentProfile.overrides);let external;
  if(spec.database){process.loadEnvFile(resolve(root,'.env.local'));Object.assign(env,Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('NEXT_PUBLIC_'))));env.QUANTOS_RUN_F05_POSTGRES_TESTS='1';const url=new URL(env.DATABASE_URL);assert(url.hostname.endsWith('.supabase.com'),'only configured Supabase database permitted');}
  if(spec.staticOnly){const isolated=staticEnvironment(env);for(const key of Object.keys(env))delete env[key];Object.assign(env,isolated);}
  Object.assign(env,spec.env??{});
  if(engineScope)env.QUANTOS_TEST_ENGINE_SCOPE=engineScope;
  if(spec.artifactKind==='r1-process-cleanup')env.QUANTOS_R1_ENGINE_BASELINE=engineBaseline;
  if(spec.measurement){env.QUANTOS_F05_MEASUREMENTS_PATH=resolve(out,'f05-volume.json');rmSync(env.QUANTOS_F05_MEASUREMENTS_PATH,{force:true});}
  let command=spec.command.map(c=>c==='node'?process.execPath:c);
  if(spec.target||spec.reproducibility)external=mkdtempSync(resolve(tmpdir(),'quantos-a1-f06-'));
  if(spec.reproducibility)command.push('--output',resolve(external,'f01-reproducibility.json'));
  if(spec.output){command.push(resolve(out,spec.output));}
  const executedAt=new Date().toISOString();const execute=args=>spawnSync(command[0],args,{cwd:root,env,encoding:'utf8',timeout:spec.timeoutMs??900000,maxBuffer:32*1024*1024});let runs;
  if(spec.target){runs=runTargetAttempts(attempt=>{const evidenceDir=resolve(external,'attempt-'+attempt);const run=execute([...command.slice(1),evidenceDir]);let diagnostic='';const summary=resolve(evidenceDir,'target-results.json');if(existsSync(summary)){const last=JSON.parse(readFileSync(summary)).results.at(-1);if(['preflight','auth-bff','auth-runtime'].includes(last?.name)&&last.exit_code!==0)diagnostic=readFileSync(resolve(evidenceDir,last.name+'.log'),'utf8');}return {...run,evidenceDir,diagnostic};},spec.maxAttempts);}else if(spec.transientDatabase)runs=runDatabaseAttempts(()=>{if(spec.measurement)rmSync(env.QUANTOS_F05_MEASUREMENTS_PATH,{force:true});return execute(command.slice(1));},spec.maxAttempts);else runs=[execute(command.slice(1))];
  const run=runs.at(-1);let output=runs.map((r,i)=>((spec.target||spec.transientDatabase)?'Target attempt '+(i+1)+' exit '+r.status+'\n':'')+(r.stdout??'')+(r.stderr??'')).join('\n');
  for(const [key,value]of Object.entries(env))if(value&&value.length>=6&&/PASSWORD|TOKEN|KEY|DATABASE_URL|TEST_EMAIL/i.test(key))output=output.split(value).join('[REDACTED]');
  const log=directory+'/logs/'+id+'.log';const result={id,command:spec.command,exitCode:run.status,status:run.status===0?'PASS':'FAIL',executedAt,log,logSha256:digest(output)};
  const persist=()=>{writeFileSync(resolve(root,log),output);if(spec.transientDatabase)result.attempts=runs.map((r,i)=>({attempt:i+1,exitCode:r.status,transient:r.transient}));if(spec.env)result.environmentOverrides=spec.env;
  if(spec.artifact&&run.status!==0){const failedArtifact=spec.output?resolve(out,spec.output):resolve(root,spec.artifact);if(existsSync(failedArtifact)){const failed=resolve(out,'failed-'+id,failedArtifact.split('/').at(-1));mkdirSync(dirname(failed),{recursive:true});if(failedArtifact!==failed)cpSync(failedArtifact,failed);result.failedArtifact=relative(root,failed);result.failedArtifactSha256=digest(readFileSync(failed));}}
  if((spec.reproducibility||spec.measurement||spec.artifact)&&run.status===0){const artifact=spec.reproducibility?resolve(external,'f01-reproducibility.json'):spec.measurement?resolve(out,'f05-volume.json'):spec.output?resolve(out,spec.output):resolve(root,spec.artifact);result.artifact=directory+'/'+(spec.reproducibility?'f01-reproducibility.json':spec.measurement?'f05-volume.json':'supporting/'+id+'/'+artifact.split('/').at(-1));mkdirSync(dirname(resolve(root,result.artifact)),{recursive:true});try{validateArtifact(spec.reproducibility?'f01-reproducibility':spec.measurement?'f05-volume':spec.artifactKind,artifact,source);}catch(error){result.exitCode=1;result.status='FAIL';output+='\nFunctional artifact validation failed: '+error.message+'\n';writeFileSync(resolve(root,log),output);result.logSha256=digest(output);}if(artifact!==resolve(root,result.artifact))cpSync(artifact,resolve(root,result.artifact));result.artifactSha256=digest(readFileSync(artifact));const supporting=supportingArtifactPaths(spec.artifactKind,JSON.parse(readFileSync(artifact)));result.supportingArtifacts=supporting.map(name=>{const bytes=readFileSync(resolve(dirname(artifact),name));const path=dirname(result.artifact)+'/'+name;mkdirSync(dirname(resolve(root,path)),{recursive:true});writeFileSync(resolve(root,path),bytes);return {path,sha256:digest(bytes)};});}
  if(spec.target&&run.status===0&&existsSync(resolve(run.evidenceDir,'f06-receipt.json'))){result.target='configured-supabase';result.targetEvidence=directory+'/f06-target.json';cpSync(resolve(run.evidenceDir,'f06-receipt.json'),resolve(root,result.targetEvidence));result.targetEvidenceSha256=digest(readFileSync(resolve(root,result.targetEvidence)));}
  if(spec.reproducibility&&run.status!==0&&existsSync(resolve(external,'f01-reproducibility.json')))cpSync(resolve(external,'f01-reproducibility.json'),resolve(out,'failed-f01-reproducibility.json'));if(spec.database)result.target='configured-supabase';if(external&&!spec.reproducibility){result.attempts=runs.map((r,i)=>({attempt:i+1,exitCode:r.status,transient:r.transient}));for(const [i,r]of runs.entries())if(r.status!==0){const failed=resolve(out,'failed-f06-target','attempt-'+(i+1));mkdirSync(failed,{recursive:true});for(const name of ['target-results.json','build.log','preflight.log','auth-bff.log','auth-runtime.log','execution.log','vault.log','database.log','database-fixtures.jsonl','database-cleanup.json'])if(existsSync(resolve(r.evidenceDir,name)))cpSync(resolve(r.evidenceDir,name),resolve(failed,name));}}if(external)rmSync(external,{recursive:true,force:true});results.set(id,result);writeFileSync(resolve(out,'execution-results.json'),JSON.stringify([...results.values()],null,2)+'\n');};if(spec.reproducibility||spec.target||spec.cleanSource)deferred.push(persist);else {for(const save of deferred.splice(0))save();persist();}console.log(id,run.status);
  if(run.status!==0)console.error(`functional execution failed ${id}; see ${log}`);
 }
 for(const save of deferred.splice(0))save();
 if(engineBaselineDir)rmSync(engineBaselineDir,{recursive:true,force:true});
 assert([...results.values()].every(r=>r.exitCode===0),'functional execution failed; no READY records published');
 const currentNodes=nodesFromPlans();assertInputSnapshot(initialInputs,captureInputs(currentNodes,selected,policy()));
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),source,'source commit changed during execution');
 for(const id of selected){const n=nodes.get(id);const spec=p.nodes[id];const m={schema:'quantos-stage-functional-manifest/v1',nodeId:id,stage:'DEVELOPMENT',status:'PASS',scope:spec.scope,formalAccepted:false,observedSourceCommit:source,environment,planInput:initialInputs.get(id).planInput,inputs:initialInputs.get(id).inputs,checks:spec.checks.map(c=>results.get(c)),dependencies:n.dependencies.map(dep=>({nodeId:dep,inputDigest:nodes.get(dep).stage_gate.input_digest,manifest:'docs/'+nodes.get(dep).stage_gate.evidence[0]})),excluded:p.excluded,residuals:[]};const path=directory+'/'+id.toLowerCase().replaceAll(':','-')+'.json';const bytes=JSON.stringify(m,null,2)+'\n';writeFileSync(resolve(root,path),bytes);n.stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:digest(bytes),evidence:[path.slice(5)]};validateReceipt(id,{nodes});}
 const admitted=new Map(selected.map(id=>[id,nodes.get(id)]));const updated=[publishStages(texts[0],admitted,'CORE:'),publishStages(texts[1],admitted,'FE:')];validatePlans(...updated);for(let i=0;i<2;i++)writeFileSync(resolve(root,planPaths[i]),updated[i]);
 for(const id of rootIds)console.log(JSON.stringify(validateReceipt(id,{nodes}),null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{if(process.argv[2]==='--assess'||process.argv[2]==='--assess-f0'||process.argv[2]==='--assess-r02'||process.argv[2]==='--assess-tp01-c'||process.argv[2]==='--assess-tp01-d'||process.argv[2]==='--assess-tp04'||process.argv[2]==='--assess-tp03'||process.argv[2]==='--assess-tp02'){assert(process.argv.length<=4,'usage: --assess [evidence-directory]');assess(process.argv[3],process.argv[2]==='--assess-tp04'?['CORE:TP04']:process.argv[2]==='--assess-tp03'?['CORE:TP03']:process.argv[2]==='--assess-tp02'?['CORE:TP02']:process.argv[2]==='--assess-tp01-d'?['CORE:TP01-D']:process.argv[2]==='--assess-tp01-c'?['CORE:TP01-C']:process.argv[2]==='--assess-r02'?['CORE:R02']:process.argv[2]==='--assess-f0'?['PROVIDER:A1','CORE-GATE:F0']:undefined);}else {assert(process.argv.length===2 || (process.argv.length===3&&process.argv[2]==='--f0'),'usage: [--assess | --assess-f0 | --f0]');console.log(JSON.stringify(validateReceipt(process.argv[2]==='--f0'?'CORE-GATE:F0':'PROVIDER:A1'),null,2));}}catch(e){console.error(e.message);process.exitCode=1;}}
