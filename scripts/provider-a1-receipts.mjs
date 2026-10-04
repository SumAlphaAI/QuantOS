import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,realpathSync,statSync,existsSync,mkdtempSync,cpSync,rmSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {validatePlans} from './check-development-plans.mjs';
export const root=resolve(import.meta.dirname,'..');
export const digest=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
export const directory='docs/audit/evidence/provider-a1-remediation-20261004';
const planPaths=['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'];
export function nodesFromPlans(texts=planPaths.map(p=>readFileSync(resolve(root,p),'utf8'))) {
 const tasks=validatePlans(...texts).tasks;
 const nodes=new Map(tasks.map(n=>[n.task_type==='CORE'?`CORE:${n.task_id}`:`FE:${n.task_id}`,n]));
 for(const text of texts)for(const block of text.matchAll(/```json\n([\s\S]*?)\n```/g)){const n=JSON.parse(block[1]);if(n.checkpoint_id)nodes.set(n.checkpoint_id,n);}
 for(const [id,n]of nodes){n.id=id;n.dependencies=n.depends_on.map(d=>d.includes(':')?d:`FE:${d}`);
  if(n.task_id){const text=texts[n.task_type==='CORE'?0:1];const start=text.indexOf(`<a id="task-${n.task_id.toLowerCase()}"></a>`);const end=text.indexOf('<a id=',start+10);n.requirements=text.slice(start,end<0?undefined:end).split('\n').filter(line=>/^- (需求描述|量化验收标准|集成验收标准|验收标准|完成标准|目标阶段与验收|验收重点|页面级完成标准|交付节点与放行条件)：/.test(line));assert(n.requirements.length>=2,`${id}: normative requirements missing`);}
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
 const paths=[...new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{cwd:base,encoding:'utf8'}).trim().split('\n'))].filter(p=>p&&selectors.some(s=>matches(p,s))).sort();
 for(const selector of selectors)assert(paths.some(p=>matches(p,selector)),`missing required input selector ${selector}`);
 return paths.map(path=>({path,role:path.startsWith('bff/')||path.startsWith('proto/')?'contract':/test|fixture|negative|mutation/.test(path)?'test':/\.(json|ya?ml|toml)$|lock$|Makefile|nvmrc/.test(path)?'config':'code',sha256:digest(readFileSync(confined(path,base)))}));
}
export function policy(base=root){return JSON.parse(readFileSync(resolve(base,'scripts/provider-a1-policy.json'),'utf8'));}
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
  assert(c.log.startsWith(directory+'/logs/'),'log outside evidence directory');const log=readFileSync(confined(c.log,base));assert.equal(digest(log),c.logSha256,'log content changed');assert(log.length>0,'empty execution log');if(check.marker)assert(new RegExp(check.marker).test(log.toString()),`required execution marker missing ${c.id}`);
  if(check.database)assert.equal(c.target,'configured-supabase','actual database execution missing');
  if(check.target){assert.equal(c.target,'configured-supabase','target database execution required');assert(c.targetEvidence,'target receipt required');const raw=readFileSync(confined(c.targetEvidence,base));assert.equal(digest(raw),c.targetEvidenceSha256,'target receipt changed');const r=JSON.parse(raw);assert.equal(r.schema,'quantos-f06-target-acceptance/v2');assert.equal(r.status,'PASS');assert.equal(r.targetClass,'configured-test-supabase-local-services');assert.equal(r.sourceCommit,m.observedSourceCommit);assert.deepEqual(r.evidence.map(e=>e.name),['build','preflight','auth-bff','auth-runtime','execution','vault','database']);assert.deepEqual(r.failures,[]);for(const key of ['realOidcBff','executionRoleAndVault','denialMatrix'])assert.equal(r[key]?.status,'PASS');for(const e of r.evidence){assert.equal(e.exit_code,0);assert.equal(createHash('sha256').update(gunzipSync(Buffer.from(e.logGzipBase64,'base64'))).digest('hex'),e.logSha256,'target execution log digest mismatch');}}
 }
 assert.deepEqual(m.dependencies.map(d=>d.nodeId).sort(),[...n.dependencies].sort(),'dependency receipt inventory mismatch');
 for(const d of m.dependencies){const dep=nodes.get(d.nodeId);assert(dep&&dep.stage_gate.status==='READY',`unready dependency ${d.nodeId}`);assert.equal(d.inputDigest,dep.stage_gate.input_digest,'dependency receipt changed');assert.equal(d.manifest,'docs/'+dep.stage_gate.evidence[0]);validateReceipt(d.nodeId,{nodes,base,visited});}
 return {status:'READY',nodeId:id,inputDigest:gate.input_digest,formalAccepted:false};
}
export function publishStages(text,nodes,namespace) {
 return text.replace(/^- stage_gate: (\{.*\})$/gm,(block,raw,offset)=>{const task=[...text.slice(0,offset).matchAll(/^- task_id: `([^`]+)`/gm)].at(-1)?.[1];return nodes.has(namespace+task)?'- stage_gate: '+JSON.stringify(nodes.get(namespace+task).stage_gate):block;}).replace(/```json\n([\s\S]*?)\n```/g,(block,raw)=>{const data=JSON.parse(raw);if(!nodes.has(data.checkpoint_id))return block;data.stage_gate=nodes.get(data.checkpoint_id).stage_gate;return '```json\n'+JSON.stringify(data,null,2)+'\n```';});
}
export function assess() {
 assert.equal(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim(),'','commit source before recording functional execution');
 const texts=planPaths.map(p=>readFileSync(resolve(root,p),'utf8'));const nodes=nodesFromPlans(texts);const selected=closure(nodes);const p=policy();const out=resolve(root,directory);mkdirSync(resolve(out,'logs'),{recursive:true});
 const source=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();const environment={node:process.version,pnpm:execFileSync('pnpm',['--version'],{encoding:'utf8'}).trim(),rust:execFileSync('rustc',['--version'],{encoding:'utf8'}).trim(),platform:process.platform};
 const all=[...new Set(selected.flatMap(id=>p.nodes[id].checks))].sort((a,b)=>Number(Boolean(p.checks[b].target))-Number(Boolean(p.checks[a].target)));const results=new Map();
 for(const id of all){const spec=p.checks[id];const env={...process.env,QUANTOS_CLIENT_PROFILE:'mock',QUANTOS_SKIP_ENV:'1',QUANTOS_RUN_F09_POSTGRES_TESTS:'0'};let external;
  if(spec.database){process.loadEnvFile(resolve(root,'.env.local'));Object.assign(env,process.env);env.QUANTOS_RUN_F05_POSTGRES_TESTS='1';const url=new URL(env.DATABASE_URL);assert(url.hostname.endsWith('.supabase.com'),'only configured Supabase database permitted');}
  let command=spec.command.map(c=>c==='node'?process.execPath:c);
  if(spec.target){external=mkdtempSync(resolve(tmpdir(),'quantos-a1-f06-'));command.push(external);}
  if(spec.output){command.push(resolve(out,spec.output));}
  const executedAt=new Date().toISOString();const run=spawnSync(command[0],command.slice(1),{cwd:root,env,encoding:'utf8',timeout:900000,maxBuffer:32*1024*1024});let output=(run.stdout??'')+(run.stderr??'');
  for(const [key,value]of Object.entries(env))if(value&&value.length>=6&&/PASSWORD|TOKEN|KEY|DATABASE_URL|TEST_EMAIL/i.test(key))output=output.split(value).join('[REDACTED]');
  const log=directory+'/logs/'+id+'.log';writeFileSync(resolve(root,log),output);const result={id,command:spec.command,exitCode:run.status,status:run.status===0?'PASS':'FAIL',executedAt,log,logSha256:digest(output)};
  if(spec.target&&existsSync(resolve(external,'f06-receipt.json'))){result.target='configured-supabase';result.targetEvidence=directory+'/f06-target.json';cpSync(resolve(external,'f06-receipt.json'),resolve(root,result.targetEvidence));result.targetEvidenceSha256=digest(readFileSync(resolve(root,result.targetEvidence)));}
  if(spec.database)result.target='configured-supabase';if(external){if(run.status!==0){const failed=resolve(out,'failed-f06-target');mkdirSync(failed,{recursive:true});for(const name of ['target-results.json','build.log','preflight.log','auth-bff.log','auth-runtime.log','execution.log','vault.log','database.log'])if(existsSync(resolve(external,name)))cpSync(resolve(external,name),resolve(failed,name));}rmSync(external,{recursive:true,force:true});}results.set(id,result);writeFileSync(resolve(out,'execution-results.json'),JSON.stringify([...results.values()],null,2)+'\n');console.log(id,run.status);
  assert.equal(run.status,0,`functional execution failed ${id}; see ${log}`);
 }
 for(const id of selected){const n=nodes.get(id);const spec=p.nodes[id];const m={schema:'quantos-stage-functional-manifest/v1',nodeId:id,stage:'DEVELOPMENT',status:'PASS',scope:spec.scope,formalAccepted:false,observedSourceCommit:source,environment,planInput:planInput(n),inputs:inventory([...p.commonInputs,...spec.inputs]),checks:spec.checks.map(c=>results.get(c)),dependencies:n.dependencies.map(dep=>({nodeId:dep,inputDigest:nodes.get(dep).stage_gate.input_digest,manifest:'docs/'+nodes.get(dep).stage_gate.evidence[0]})),excluded:p.excluded,residuals:[]};const path=directory+'/'+id.toLowerCase().replaceAll(':','-')+'.json';const bytes=JSON.stringify(m,null,2)+'\n';writeFileSync(resolve(root,path),bytes);n.stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:digest(bytes),evidence:[path.slice(5)]};validateReceipt(id,{nodes});}
 const admitted=new Map(selected.map(id=>[id,nodes.get(id)]));const updated=[publishStages(texts[0],admitted,'CORE:'),publishStages(texts[1],admitted,'FE:')];validatePlans(...updated);for(let i=0;i<2;i++)writeFileSync(resolve(root,planPaths[i]),updated[i]);
 console.log(JSON.stringify(validateReceipt('PROVIDER:A1',{nodes}),null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{if(process.argv[2]==='--assess')assess();else {assert.equal(process.argv.length,2,'usage: [--assess]');console.log(JSON.stringify(validateReceipt('PROVIDER:A1'),null,2));}}catch(e){console.error(e.message);process.exitCode=1;}}
