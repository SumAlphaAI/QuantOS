// Consumer-scoped admission only; upstream target gates are never published.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,rmSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,digest,nodesFromPlans,planInput,closure,localDeferred,validateLocalPrerequisites,publishStages,validateReceipt} from './provider-a1-receipts.mjs';
import {coverage as s03Coverage,expectedNodes as s03Nodes} from './s03-local-gate.mjs';
export const profile='SERVICE-S04_LOCAL',nodeId='SERVICE:S04';
export const manifest='docs/audit/evidence/service-s04-local-20261016/manifest.json';
export const deferredTargets=[
 {id:'durable-target',target:'actual Supabase active-session/member authorization, durable strategy/draft/backtest/Release/audit transactions, workspace RLS, approval CAS and cross-process recovery; all inherited S01/S02/S03/F06/R1 obligations',status:'NOT_RUN'},
 {id:'deployment-target',target:'authorized deployed strategy API and Paper/Shadow consumer, trusted host identity/clock/provenance, revocation, immutable source/image, OS credential isolation and rollback; public BFF/UI by their own integration gates',status:'NOT_RUN'},
 {id:'target-performance',target:'representative deployment security, load, performance and sustained canary/rollback obligations',status:'NOT_RUN'},
 {id:'same-sha-ci',target:'hosted CI at frozen release candidate and ProjectUser formal confirmation',status:'NOT_RUN'},
];
export const handoff="SERVICE-S04_LOCAL 发布移交：继承S01、S02、S03、F06及R1-SERVICE全部22组目标义务；实际Supabase身份/成员权限、持久草稿/回测/Release/审计事务、跨进程审批CAS与恢复、可信时钟及Artifact/源码/镜像绑定、真实部署Paper/Shadow消费与撤权、OS隔离、安全/负载/性能/长稳和候选同SHA hosted CI由测试及RELEASE-GATE:BETA首次发布前实际验收，未执行NOT_RUN。P06/P07和20个UI fixture归CORE:S04/G3，公共BFF映射归BFF-FE-004；本地真实TCP与UDS不构成页面、目标数据库或发布验收。本地DEVELOPMENT READY仅属于SERVICE:S04，不授予上游、正式ACCEPTED、生产或外部发布授权。";
export const expectedNodes=[...s03Nodes,nodeId];
export const selectedNodes=nodes=>[...new Set([nodeId].flatMap(id=>closure(nodes,id)))];
export const testNames=["service_s04_owned_tcp_generator_to_release_and_two_consumers", "service_s04_hundred_unverified_unapproved_denials_are_audited", "service_s04_capability_scope_session_and_identity_forgery_are_rejected", "service_s04_static_failures_bad_inputs_and_stale_versions_recover", "service_s04_approval_rejection_expiry_hash_and_twenty_way_cas_are_audited", "service_s04_hundred_provenance_forgery_requests_and_limits_are_rejected"];
export function coverage(local,{read=p=>JSON.parse(readFileSync(resolve(root,p))),readLog=p=>readFileSync(resolve(root,p),'utf8')}={}){
 const dependencyCoverage=s03Coverage(local,{read,readLog}),checks=new Map();for(const n of local.nodes)for(const c of read(n.manifest).checks)checks.set(c.id,c);
 assert(checks.get('service-s04-rust')?.log,'missing actual SERVICE:S04 log');const log=readLog(checks.get('service-s04-rust').log);
 for(const name of testNames)assert(log.includes('test '+name+' ... ok'),'missing HTTP case '+name);
 assert(/test result: ok\. 6 passed; 0 failed; 0 ignored/.test(log),'HTTP cases failed or skipped');
 assert(log.includes('test service::tests::service_s04_clock_is_sampled_under_service_lock ... ok'),'expiry transaction clock regression missing or skipped');
 const rows=[...log.matchAll(/^SERVICE_S04_EVIDENCE=(.+)$/gm)];assert.equal(rows.length,1,'actual HTTP proof missing or duplicated');
 const e=JSON.parse(rows[0][1]),r=e.release.release,v=e.backtest.report;
 assert.equal(e.source_commit,local.observedSourceCommit);assert.equal(r.source_digest,local.observedSourceCommit);assert.equal(v.candidate.source_commit,local.observedSourceCommit);
 assert.equal(e.transport,'owned-loopback-tcp');assert.equal(e.generator_artifacts,102);assert.equal(e.databaseExecution,false);assert.equal(e.externalPublished,false);
 assert.equal(e.release.approval_state,'approved');assert.equal(r.approval.actor_id,r.approved_by);assert.notEqual(r.approved_by,r.created_by);assert.equal(r.approval.content_hash,r.content_hash);assert.equal(r.approved_at,r.approval.approved_at);assert(Date.parse(r.approved_at)<Date.parse(r.approval.expires_at));
 for(const [a,b]of [['tenant_id','tenant_id'],['workspace_id','workspace_id'],['draft_id','draft_id'],['draft_version','version']])assert.equal(r[a],v.draft[b]);
 assert.equal(r.data_snapshot_id,v.snapshot_id);assert.equal(r.parameter_hash,v.parameter_hash);assert.equal(r.image_digest,v.candidate.image_digest);assert.equal(r.backtest_report_hash,v.report_hash);assert.deepEqual(r.validation.report,v);
 assert.deepEqual(r.allowed_targets,['paper','shadow']);assert.deepEqual(e.consumer_report_hashes,[v.report_hash,v.report_hash]);
 const events=e.audit.items;assert(events.length>=15,'audit evidence incomplete');let prior=digest('strategy-audit/v1');const correlations=new Set();
 for(const [i,event]of events.entries()){
  assert.equal(event.sequence,i+1);assert.equal(event.previous_hash,prior);assert.equal(event.tenant_id,r.tenant_id);assert.equal(event.workspace_id,r.workspace_id);assert.match(event.correlation_id,/^[0-9a-f-]{36}$/);assert(!correlations.has(event.correlation_id));correlations.add(event.correlation_id);
  const {content_hash,...value}=event;assert.equal(content_hash,digest(canonical(value)),'audit bytes changed');prior=content_hash;
 }
 for(const op of ['lab.preview','draft.create','draft.save','draft.static_check','backtest.create','release.publish','release.approve','deployment.create','deployment.consume'])assert(events.some(a=>a.operation===op&&a.status===200),'missing success audit '+op);
 assert(events.some(a=>a.code==='RELEASE_UNAPPROVED'&&a.status===409));assert(events.some(a=>a.operation==='release.approve'&&a.actor_id===r.approved_by&&a.resource_hash===r.content_hash));
 return {dependencyCoverage,releaseHash:r.content_hash,transport:e.transport,generatorArtifacts:102,deniedUnverifiedUnapproved:100,forgedRequests:100,concurrentApprovers:20,oneApproval:true,freshTransactionClock:true,scopeSessionCapability:true,auditChainEvents:events.length,auditHead:prior,twoNativeConsumers:true,localOnly:true};
}
function canonical(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';}
export function verify(r,{nodes=nodesFromPlans(),validateLocal=validateLocalPrerequisites,readFunctional,readLog}={}){
 assert.deepEqual(selectedNodes(nodes),expectedNodes,'authorized thirty-six-node closure changed');
 assert.deepEqual(nodes.get(nodeId).dependencies,['CORE:S01','CORE:S02','CORE:S03','CORE:F06','CORE-GATE:R1-SERVICE'],'direct consumer scope changed');
 assert.equal(r.schema,'quantos-service-s04-local-development/v1');assert.equal(r.nodeId,nodeId);assert.equal(r.stage,'DEVELOPMENT');assert.equal(r.profile,profile);assert.equal(r.status,'READY');
 for(const key of ['databaseExecution','production','formalAccepted','externalExecution','performanceAccepted','syncApproved','targetCanaryAccepted','targetRollbackAccepted','externalPublished','upstreamAccepted'])assert.equal(r[key],false);
 assert.equal(r.engineeringStatus,'PASS');assert.match(r.observedSourceCommit,/^[a-f0-9]{40}$/);
 assert.deepEqual(r.planInput,planInput(nodes.get(nodeId)),'SERVICE:S04 normative scope changed');
 assert(nodes.get(nodeId).required_scope.includes(profile),'SERVICE:S04 local scope missing');
 assert(nodes.get('RELEASE-GATE:BETA').required_scope.includes(handoff),'SERVICE release obligation removed');
 assert.equal(r.release.checkpoint,'RELEASE-GATE:BETA');assert.equal(r.release.status,'NOT_RUN');assert.equal(r.release.handoff,handoff);
 assert.deepEqual(r.release.prerequisiteChecks,localDeferred(nodes,undefined,profile),'deferred obligations changed');
 assert.deepEqual(r.release.functionalTargets,deferredTargets,'service target obligations missing or promoted');
 const local=validateLocal(r.localPrerequisites.manifest,{nodes,profile});assert.equal(local.status,'LOCAL_READY');assert.equal(local.owner,nodeId);assert.equal(local.profile,profile);
 assert.equal(local.inputDigest,r.localPrerequisites.inputDigest,'local index digest changed');assert.equal(local.observedSourceCommit,r.observedSourceCommit,'mixed candidates');
 assert.deepEqual(local.nodes.map(n=>n.nodeId),selectedNodes(nodes),'complete thirty-six-node closure required');assert.equal(local.nodes.length,36);
 const own=local.nodes.find(n=>n.nodeId===nodeId);assert.equal(r.functionalManifest,own.manifest);assert.equal(r.functionalDigest,own.inputDigest);
 assert.deepEqual(r.dependencies,nodes.get(nodeId).dependencies.map(id=>({nodeId:id,status:'LOCAL_READY',owner:nodeId,inputDigest:local.nodes.find(n=>n.nodeId===id).inputDigest})),'local dependency proof changed');
 assert.deepEqual(r.coverage,coverage(local,{read:readFunctional,readLog}),'service coverage missing or altered');
 return {nodeId,stageGate:'READY',engineeringStatus:'PASS',profile,necessaryNodes:36,databaseAcceptance:'NOT_RUN',releaseGate:'NOT_ASSESSED',formalAccepted:false,observedSourceCommit:r.observedSourceCommit};
}
export function verifyPublished({nodes=nodesFromPlans()}={}){
 const gate=nodes.get(nodeId).stage_gate;assert.equal(gate.status,'READY','SERVICE:S04 local admission not READY');assert.deepEqual(gate.evidence,[manifest.slice(5)]);
 const bytes=readFileSync(resolve(root,manifest));assert.equal(digest(bytes),gate.input_digest,'published SERVICE:S04 digest changed');const result=verify(JSON.parse(bytes),{nodes});return result;
}
export function publish(index,{getNodes=nodesFromPlans,validateLocal=validateLocalPrerequisites,validate=verify,readFunctional,readLog,read=p=>existsSync(resolve(root,p))?readFileSync(resolve(root,p),'utf8'):null,write=(p,bytes)=>{if(bytes===null)rmSync(resolve(root,p),{force:true});else{mkdirSync(dirname(resolve(root,p)),{recursive:true});writeFileSync(resolve(root,p),bytes);}},verifyAfter=verifyPublished}={}){
 const nodes=getNodes(),local=validateLocal(index,{nodes,profile}),own=local.nodes.find(n=>n.nodeId===nodeId);
 const r={schema:'quantos-service-s04-local-development/v1',nodeId,stage:'DEVELOPMENT',profile,status:'READY',engineeringStatus:'PASS',databaseExecution:false,production:false,formalAccepted:false,externalExecution:false,performanceAccepted:false,syncApproved:false,targetCanaryAccepted:false,targetRollbackAccepted:false,externalPublished:false,upstreamAccepted:false,observedSourceCommit:local.observedSourceCommit,
  coverage:coverage(local,{read:readFunctional,readLog}),planInput:planInput(nodes.get(nodeId)),localPrerequisites:{manifest:index,inputDigest:local.inputDigest},functionalManifest:own.manifest,functionalDigest:own.inputDigest,
  dependencies:nodes.get(nodeId).dependencies.map(id=>({nodeId:id,status:'LOCAL_READY',owner:nodeId,inputDigest:local.nodes.find(n=>n.nodeId===id).inputDigest})),release:{checkpoint:'RELEASE-GATE:BETA',status:'NOT_RUN',handoff,prerequisiteChecks:localDeferred(nodes,undefined,profile),functionalTargets:deferredTargets}};
 validate(r,{nodes,readFunctional,readLog});const bytes=JSON.stringify(r,null,2)+'\n';
 nodes.get(nodeId).stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:digest(bytes),evidence:[manifest.slice(5)]};
 const updates=new Map([[manifest,bytes]]);
 for(const [path,namespace]of [['docs/SumAlpha-QuantOS-Development-Plan.md','CORE:'],['docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md','FE:']])updates.set(path,publishStages(read(path),new Map([[nodeId,nodes.get(nodeId)]]),namespace));
 const before=new Map([...updates.keys()].map(path=>[path,read(path)]));
 try{for(const [path,value]of updates)write(path,value);return verifyAfter();}catch(error){for(const [path,value]of before)write(path,value);throw error;}
}
export function releaseCheck({nodes=nodesFromPlans(),validate=validateReceipt,read=p=>readFileSync(resolve(root,p))}={}){
 const beta=nodes.get('RELEASE-GATE:BETA');assert.equal(beta.stage_gate.status,'READY','release target evidence NOT_RUN');assert.equal(beta.review_status,'ACCEPTED','formal release confirmation missing');assert.match(beta.source_commit??'',/^[a-f0-9]{40}$/);
 const selected=selectedNodes(nodes);for(const id of selected){validate(id,{nodes});const raw=JSON.parse(read('docs/'+nodes.get(id).stage_gate.evidence[0]));assert.equal(raw.schema,'quantos-stage-functional-manifest/v1','local manifests cannot grant release');assert.equal(raw.observedSourceCommit,beta.source_commit,'release candidate differs');}
 return {releaseGate:'READY',formalAccepted:true,productionAuthorization:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert(['--ready','--release'].includes(process.argv[2])&&process.argv.length===3);console.log(JSON.stringify(process.argv[2]==='--release'?releaseCheck():verifyPublished(),null,2));}catch(error){console.error(error.message.split('\n')[0]);process.exitCode=2;}}
