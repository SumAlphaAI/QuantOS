import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {nodesFromPlans,validateReceipt,digest,closure} from '/Users/anray/Documents/project/SumAlpha/QuantOS/scripts/provider-a1-receipts.mjs';
const root='/Users/anray/Documents/project/SumAlpha/QuantOS';const actual=nodesFromPlans();const selected=closure(actual,'CORE:TP01-D');for(const id of selected)validateReceipt(id);
const original='docs/'+actual.get('CORE:TP01-D').stage_gate.evidence[0];const input=JSON.parse(readFileSync(resolve(root,original)));const out=dirname(original);const results=[];
for(const [name,change,marker]of [
 ['source inventory', (m)=>m.inputs[0].sha256='sha256:'+'0'.repeat(64),/inventory or content changed/],
 ['log digest',(m)=>m.checks[0].logSha256='sha256:'+'0'.repeat(64),/log content changed/],
 ['formal claim',(m)=>m.formalAccepted=true,/false/],
 ['missing check',(m)=>m.checks.pop(),/required functional checks/],
 ['fake command',(m)=>m.checks[0].command=['true'],/actual command differs/],
 ['dependency digest',(m)=>m.dependencies[0].inputDigest='sha256:'+'0'.repeat(64),/dependency receipt changed/],
 ['execution source',(m)=>m.observedSourceCommit='0'.repeat(40),/execution source differs/],
]){
 const m=structuredClone(input);change(m);const path=out+'/probe-'+name.replaceAll(' ','-')+'.json';const bytes=JSON.stringify(m,null,2)+'\n';writeFileSync(resolve(root,path),bytes);const nodes=structuredClone(actual);nodes.get('CORE:TP01-D').stage_gate={stage:'DEVELOPMENT',status:'READY',input_digest:digest(bytes),evidence:[path.slice(5)]};let rejection;try{validateReceipt('CORE:TP01-D',{nodes});}catch(e){rejection=e.message;}finally{rmSync(resolve(root,path));}assert(rejection, name+' accepted');assert.match(rejection,marker);results.push({name,status:'REJECTED',reason:rejection.split('\n')[0]});
}
for(const name of ['manifest digest','unready dependency']){const nodes=structuredClone(actual);if(name==='manifest digest')nodes.get('CORE:TP01-D').stage_gate.input_digest='sha256:'+'0'.repeat(64);else nodes.get(input.dependencies[0].nodeId).stage_gate={stage:'DEVELOPMENT',status:'NOT_ASSESSED',input_digest:null,evidence:[]};let rejection;try{validateReceipt('CORE:TP01-D',{nodes});}catch(e){rejection=e.message;}assert(rejection);assert.match(rejection,name==='manifest digest'?/manifest digest mismatch/:/unready dependency/);results.push({name,status:'REJECTED',reason:rejection.split('\n')[0]});}
const counts={};for(const n of actual.values())counts[n.stage_gate.status]=(counts[n.stage_gate.status]??0)+1;assert.equal(counts.READY,16);assert.equal(counts.NOT_ASSESSED,143);
const r={schema:'quantos-tp01-d-final-gate-probes/v1',status:'PASS',formalAccepted:false,strictNodes:selected,counts,manifest:original,probes:results};writeFileSync(resolve(root,'docs/audit/evidence/tp01-d-20261009/final-gate-probes.json'),JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r,null,2));
