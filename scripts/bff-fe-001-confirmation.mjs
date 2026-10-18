import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {bytesDigest,validateCommittedProseConfirmation,reviewDimensions} from './user-acceptance-confirmation.mjs';
import {planInput} from './provider-a1-receipts.mjs';
const base='docs/audit/evidence/bff-fe-001-confirmation-20261018/';
export const originalCommit='4f261e677db6980f08f5658ec1560693fce355ec';
// Historical scope is parsed from its immutable plans, independently of later
// task registrations. This does not validate or admit the current plan graph.
export function verifyOriginalSource(inputs,source){
 assert.match(source,/^[a-f0-9]{40}$/);const bytes=execFileSync('git',['cat-file','--batch'],{input:inputs.inputs.map(i=>source+':'+i.path+'\n').join(''),maxBuffer:64*1024*1024});let offset=0;
 for(const row of inputs.inputs){const end=bytes.indexOf(10,offset),parts=bytes.subarray(offset,end).toString().split(' ');assert.equal(parts.length,3);assert.equal(parts[1],'blob');offset=end+1;const size=Number(parts[2]);assert.equal(bytesDigest(bytes.subarray(offset,offset+size)),row.sha256,'original source drift '+row.path);offset+=size;assert.equal(bytes[offset++],10);}assert.equal(offset,bytes.length);
 const plans=['docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'].map(p=>execFileSync('git',['show',source+':'+p],{encoding:'utf8',maxBuffer:8*1024*1024}));
 for(const row of inputs.normative){let node;
  if(row.planInput.checkpoint_id){for(const text of plans)for(const match of text.matchAll(/```json\n([\s\S]*?)\n```/g)){const n=JSON.parse(match[1]);if(n.checkpoint_id===row.nodeId)node=n;}assert(node);}
  else{const text=plans[row.nodeId.startsWith('CORE:')?0:1],anchor='<a id="task-'+row.planInput.task_id.toLowerCase()+'"></a>',start=text.indexOf(anchor);assert(start>=0);const end=text.indexOf('<a id=',start+anchor.length),block=text.slice(start,end<0?undefined:end);node={};for(const match of block.matchAll(/^- ([a-z_]+): (.*)$/gm)){let value=match[2];if(value.startsWith('`')&&value.endsWith('`'))value=value.slice(1,-1);if(['depends_on','core_prerequisites','closes_core','stage_gate'].includes(match[1]))value=JSON.parse(value);node[match[1]]=value;}node.requirement=/^- 需求描述：(.*)$/m.exec(block)[1];node.requirements=block.split('\n').filter(line=>/^- (需求描述|量化验收标准|集成验收标准|验收标准|完成标准|目标阶段与验收|验收重点|页面级完成标准|交付节点与放行条件|技术要求|交付物|阶段执行|验收边界)：/.test(line));}
  node.dependencies=node.depends_on.map(d=>d.includes(':')?d:'FE:'+d);assert.deepEqual(planInput(node),row.planInput,'original normative scope changed '+row.nodeId);
 }
}
export function verifyConfirmation(){
 const approval=JSON.parse(readFileSync(base+'approval.json')),record=JSON.parse(readFileSync(approval.record)),manifest='docs/audit/evidence/bff-fe-001-local-20261018/manifest.json';
 const committedBytes=(commit,path)=>execFileSync('git',['show',commit+':'+path],{maxBuffer:64*1024*1024});
 const raw=committedBytes(originalCommit,manifest),r=JSON.parse(raw);assert.deepEqual(readFileSync(manifest),raw,'approved receipt changed');assert.equal(r.nodeId,'FE:BFF-FE-001');assert.equal(r.status,'READY');assert.equal(r.formalAccepted,false);verifyOriginalSource(r.inputs,r.observedSourceCommit);
 const request={nodeId:r.nodeId,stage:'DEVELOPMENT',sourceCommit:r.observedSourceCommit,inputsDigest:r.inputs.inputDigest,reviewDimensions};
 assert.equal(record.documentCommit,originalCommit);assert.deepEqual(record.approvedTechnicalManifest,{path:manifest,sha256:bytesDigest(raw),commit:originalCommit});
 const preflight='docs/audit/evidence/bff-fe-007-local-20261018/preflight/identity-before-change.json';assert.equal(record.preflight.sha256,bytesDigest(readFileSync(preflight)));assert.equal(record.preflight.path,preflight);const checked=JSON.parse(readFileSync(preflight));assert.equal(checked.stageGate,'READY');assert.equal(checked.observedSourceCommit,r.observedSourceCommit);
 return {...validateCommittedProseConfirmation(approval,request,{committedBytes}),nodeId:r.nodeId,approvedSourceCommit:r.observedSourceCommit,approvedReceiptCommit:originalCommit,currentHeadAcceptance:'NOT_CLAIMED',upstreamAdmission:'NOT_CLAIMED'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{assert.equal(process.argv.length,2);console.log(JSON.stringify(verifyConfirmation(),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
