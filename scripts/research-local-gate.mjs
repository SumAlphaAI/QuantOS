// Consumer-scoped local admission; target runners and formal acceptance remain separate.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,rmSync,cpSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,digest,nodesFromPlans,planInput,closure,localPolicy,localChecks,localScope,localDeferred,localIndexSchema,validateLocalPrerequisites,publishStages} from './provider-a1-receipts.mjs';
export const registrations={A2_LOCAL:{owner:'PROVIDER:A2',count:17},R1_LOCAL:{owner:'CORE-GATE:R1-SERVICE',count:27},BFF003_LOCAL:{owner:'FE:BFF-FE-003',count:40},BFF005_LOCAL:{owner:'FE:BFF-FE-005',count:40},A3_LOCAL:{owner:'PROVIDER:A3',count:42}};
export const schema='quantos-research-local-admission/v1';
export const handoff='A2_LOCAL/R1_LOCAL/BFF003_LOCAL/BFF005_LOCAL 发布移交：Supabase迁移/RLS/事务/Auth/Storage与身份设置/audit导出、Research/Snapshot/Artifact持久消费和worker取消恢复、market/watchlist持久事务及流撤权、真实盘口/成交来源用途许可、外部Engine/服务部署及OS隔离、远程漏洞库SCA与fork治理、代表性性能/容量/长稳、完整浏览器矩阵及候选同SHA CI；归RELEASE-GATE:BETA首次上线前实际验收。目标与性能NOT_RUN，本地回执不构成上游独立READY、正式ACCEPTED或生产/发布授权。';
export const evidenceBase='docs/audit/evidence/provider-a3-local-20261013';
export const manifest=profile=>evidenceBase+'/'+profile.toLowerCase().replaceAll('_','-')+'.json';
export function verify(r,{nodes=nodesFromPlans(),validateLocal=validateLocalPrerequisites,read=p=>readFileSync(resolve(root,p))}={}){
 const spec=registrations[r.profile];assert(spec,'unregistered consumer profile');const n=nodes.get(spec.owner);
 assert.equal(r.schema,schema);assert.equal(r.nodeId,spec.owner);assert.equal(r.stage,'DEVELOPMENT');assert.equal(r.status,'READY');assert.equal(r.engineeringStatus,'PASS');
 for(const key of ['databaseExecution','externalExecution','performanceAccepted','production','formalAccepted'])assert.equal(r[key],false);
 assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);assert.deepEqual(r.planInput,planInput(n),'normative scope changed');
 assert.equal(closure(nodes,n.id).length,spec.count,'consumer closure changed');
 assert.equal(r.release.checkpoint,'RELEASE-GATE:BETA');assert.equal(r.release.status,'NOT_RUN');assert.equal(r.release.handoff,handoff);assert(nodes.get('RELEASE-GATE:BETA').required_scope.includes(handoff),'release handoff removed');
 assert.deepEqual(r.release.prerequisiteChecks,localDeferred(nodes,undefined,r.profile));
 const local=validateLocal(r.localPrerequisites.manifest,{nodes,profile:r.profile});assert.equal(local.status,'LOCAL_READY');assert.equal(local.owner,spec.owner);assert.equal(local.profile,r.profile);assert.equal(local.inputDigest,r.localPrerequisites.inputDigest);assert.equal(local.observedSourceCommit,r.observedSourceCommit,'mixed source candidates');
 assert.deepEqual(local.nodes.map(x=>x.nodeId),closure(nodes,n.id),'full closure missing');
 const own=local.nodes.find(x=>x.nodeId===n.id);assert.equal(r.functionalManifest,own.manifest);assert.equal(r.functionalDigest,own.inputDigest);
 assert.deepEqual(r.dependencies,n.dependencies.map(nodeId=>({nodeId,status:'LOCAL_READY',owner:n.id,inputDigest:local.nodes.find(x=>x.nodeId===nodeId).inputDigest})),'dependency proof changed');
 if(r.profile==='A3_LOCAL'){
  const expected=n.dependencies.map(nodeId=>{const profile=Object.keys(registrations).find(p=>registrations[p].owner===nodeId);assert(profile&&profile!=='A3_LOCAL');return {nodeId,profile,manifest:manifest(profile)};});
  assert.deepEqual(r.consumerReceipts?.map(({nodeId,profile,manifest})=>({nodeId,profile,manifest})),expected,'A3 requires all published consumer receipts');
  for(const c of r.consumerReceipts){
   const bytes=read(c.manifest),gate=nodes.get(c.nodeId).stage_gate;
   assert.equal(digest(bytes),c.sha256,'A3 consumer receipt changed');assert.equal(gate.status,'READY','A3 consumer not READY');assert.deepEqual(gate.evidence,[c.manifest.slice(5)]);assert.equal(gate.input_digest,c.sha256,'A3 consumer gate changed');
   const child=JSON.parse(bytes);assert.equal(child.profile,c.profile);const proof=verify(child,{nodes,validateLocal,read});assert.equal(proof.observedSourceCommit,r.observedSourceCommit,'A3 mixed consumer candidates');
  }
 }else assert.equal(r.consumerReceipts,undefined,'consumer receipt cannot claim aggregate admission');
 return {nodeId:n.id,status:'READY',stageGate:'READY',profile:r.profile,engineeringStatus:'PASS',necessaryNodes:spec.count,localPrerequisites:{manifest:r.localPrerequisites.manifest,inputDigest:local.inputDigest,nodes:local.nodes},observedSourceCommit:r.observedSourceCommit,databaseAcceptance:'NOT_RUN',performanceAcceptance:'NOT_RUN',formalAccepted:false};
}
export function verifyPublished(profile,{nodes=nodesFromPlans(),validate=verify}={}){
 assert(registrations[profile]);const gate=nodes.get(registrations[profile].owner).stage_gate,path=manifest(profile);assert.equal(gate.stage,'DEVELOPMENT');assert.equal(gate.status,'READY','local admission not READY');assert.deepEqual(gate.evidence,[path.slice(5)]);
 const bytes=readFileSync(resolve(root,path));assert.equal(digest(bytes),gate.input_digest,'published manifest changed');const r=JSON.parse(bytes);assert.equal(r.profile,profile);return validate(r,{nodes});
}
// A subset reuses actual executions from the same forty-two-node assessment, rebinds scope
// and recursive dependencies, and validates every required check before publication.
export function deriveIndex(indexPath,profile){
 assert(Object.keys(registrations).includes(profile)||profile==='TP02_LOCAL');const spec=profile==='TP02_LOCAL'?{owner:'CORE:TP02'}:registrations[profile];const nodes=nodesFromPlans(),source=validateLocalPrerequisites(indexPath,{nodes,profile:'A3_EXECUTION'}),base=dirname(indexPath),dest=base+'-'+profile.toLowerCase().replaceAll('_','-');assert(!existsSync(dest),'fresh subset required');mkdirSync(dest,{recursive:true});cpSync(base+'/logs',dest+'/logs',{recursive:true});
 const entries=[];for(const nodeId of closure(nodes,spec.owner)){
  const original=source.nodes.find(n=>n.nodeId===nodeId);assert(original);const r=JSON.parse(readFileSync(original.manifest));const required=localChecks(nodeId,undefined,profile);assert(required.every(id=>r.checks.some(c=>c.id===id)),'subset contains unexecuted checks');
  Object.assign(r,{owner:spec.owner,profile,scope:localScope(profile),checks:required.map(id=>({...r.checks.find(c=>c.id===id),log:r.checks.find(c=>c.id===id).log.replace(base+'/',dest+'/')})),dependencies:nodes.get(nodeId).dependencies.map(id=>{const d=entries.find(x=>x.nodeId===id);assert(d);return {nodeId:id,manifest:d.manifest,inputDigest:d.inputDigest};})});
  const path=dest+'/'+nodeId.toLowerCase().replaceAll(':','-')+'.json',bytes=JSON.stringify(r,null,2)+'\n';writeFileSync(path,bytes);entries.push({nodeId,manifest:path,inputDigest:digest(bytes)});
 }
 const original=JSON.parse(readFileSync(indexPath)),path=dest+'/local-prerequisites.json';writeFileSync(path,JSON.stringify({...original,schema:localIndexSchema(profile),owner:spec.owner,profile,nodes:entries,deferred:localDeferred(nodes,undefined,profile)},null,2)+'\n');validateLocalPrerequisites(path,{nodes,profile});return path;
}
export function publish(indexes,{getNodes=nodesFromPlans,validateLocal=validateLocalPrerequisites,validate=verify,read=p=>existsSync(p)?readFileSync(p,'utf8'):null,write=(p,bytes)=>{if(bytes===null)rmSync(p,{force:true});else{mkdirSync(dirname(p),{recursive:true});writeFileSync(p,bytes);}},verifyAfter=()=>Object.keys(registrations).map(p=>verifyPublished(p))}={}){
 assert.deepEqual(Object.keys(indexes).sort(),Object.keys(registrations).sort(),'all five local indexes required');const nodes=getNodes(),updates=new Map();
 for(const profile of Object.keys(registrations)){
  const index=indexes[profile];
  const local=validateLocal(index,{nodes,profile}),nodeId=registrations[profile].owner,n=nodes.get(nodeId),own=local.nodes.find(x=>x.nodeId===nodeId);
  const r={schema,nodeId,stage:'DEVELOPMENT',profile,status:'READY',engineeringStatus:'PASS',observedSourceCommit:local.observedSourceCommit,databaseExecution:false,externalExecution:false,performanceAccepted:false,production:false,formalAccepted:false,planInput:planInput(n),localPrerequisites:{manifest:index,inputDigest:local.inputDigest},functionalManifest:own.manifest,functionalDigest:own.inputDigest,dependencies:n.dependencies.map(id=>({nodeId:id,status:'LOCAL_READY',owner:nodeId,inputDigest:local.nodes.find(x=>x.nodeId===id).inputDigest})),release:{checkpoint:'RELEASE-GATE:BETA',status:'NOT_RUN',handoff,prerequisiteChecks:localDeferred(nodes,undefined,profile)}};
  if(profile==='A3_LOCAL')r.consumerReceipts=n.dependencies.map(nodeId=>{const profile=Object.keys(registrations).find(p=>registrations[p].owner===nodeId),path=manifest(profile);assert(updates.has(path),'consumer must be validated before A3');return {nodeId,profile,manifest:path,sha256:digest(updates.get(path))};});
  validate(r,{nodes,validateLocal,read:p=>updates.has(p)?updates.get(p):read(p)});const bytes=JSON.stringify(r,null,2)+'\n';updates.set(manifest(profile),bytes);n.stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:digest(bytes),evidence:[manifest(profile).slice(5)]};
 }
 assert.equal(new Set([...updates.values()].map(x=>JSON.parse(x).observedSourceCommit)).size,1,'mixed publication candidates');
 for(const [path,namespace]of [['docs/SumAlpha-QuantOS-Development-Plan.md','CORE:'],['docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md','FE:']])updates.set(path,publishStages(read(path),new Map(Object.values(registrations).map(({owner})=>[owner,nodes.get(owner)])),namespace));
 const before=new Map([...updates.keys()].map(path=>[path,read(path)]));try{for(const [path,bytes]of updates)write(path,bytes);return verifyAfter();}catch(e){for(const [path,bytes]of before)write(path,bytes);throw e;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert(process.argv.length===3);console.log(JSON.stringify(verifyPublished(process.argv[2]),null,2));}catch(e){console.error(e.message.split('\n')[0]);process.exitCode=2;}}
