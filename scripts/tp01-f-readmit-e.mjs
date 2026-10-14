// Reuse validated actual executions from the new F candidate, never historical E runs.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,rmSync,cpSync} from 'node:fs';
import {dirname} from 'node:path';
import {digest,nodesFromPlans,closure,localChecks,localScope,localDeferred,localIndexSchema,validateLocalPrerequisites} from './provider-a1-receipts.mjs';
import {manifest as eManifest,publish as publishE,verifyPublished as verifyE} from './tp01-e-local-gate.mjs';
import {manifest as fManifest,publish as publishF,verifyPublished as verifyF} from './tp01-f-local-gate.mjs';
export function deriveE(indexPath){
 const nodes=nodesFromPlans(),source=validateLocalPrerequisites(indexPath,{nodes,profile:'TP01-F_LOCAL'}),base=dirname(indexPath),dest=base+'-tp01-e-local',profile='TP01-E_LOCAL',owner='CORE:TP01-E';assert(!existsSync(dest),'fresh E projection required');mkdirSync(dest,{recursive:true});cpSync(base+'/logs',dest+'/logs',{recursive:true});
 const entries=[];for(const nodeId of closure(nodes,owner)){
  const original=source.nodes.find(n=>n.nodeId===nodeId);assert(original,'missing executed E prerequisite');const r=JSON.parse(readFileSync(original.manifest));const required=localChecks(nodeId,undefined,profile);assert(required.every(id=>r.checks.some(c=>c.id===id)),'unexecuted E check');assert.equal(r.observedSourceCommit,source.observedSourceCommit);
  Object.assign(r,{owner,profile,scope:localScope(profile),checks:required.map(id=>({...r.checks.find(c=>c.id===id),log:r.checks.find(c=>c.id===id).log.replace(base+'/',dest+'/')})),dependencies:nodes.get(nodeId).dependencies.map(id=>{const d=entries.find(x=>x.nodeId===id);assert(d);return{nodeId:id,manifest:d.manifest,inputDigest:d.inputDigest};})});
  const path=dest+'/'+nodeId.toLowerCase().replaceAll(':','-')+'.json',bytes=JSON.stringify(r,null,2)+'\n';writeFileSync(path,bytes);entries.push({nodeId,manifest:path,inputDigest:digest(bytes)});
 }
 const path=dest+'/local-prerequisites.json';writeFileSync(path,JSON.stringify({schema:localIndexSchema(profile),owner,profile,status:'PASS',formalAccepted:false,databaseExecution:false,observedSourceCommit:source.observedSourceCommit,nodes:entries,deferred:localDeferred(nodes,undefined,profile)},null,2)+'\n');validateLocalPrerequisites(path,{nodes,profile});return path;
}
export function publishPair(eIndex,fIndex,{publishFirst=publishE,publishSecond=publishF,verify=()=>[verifyE(),verifyF()],read=p=>existsSync(p)?readFileSync(p):null,write=(p,bytes)=>{if(bytes===null)rmSync(p,{force:true});else{mkdirSync(dirname(p),{recursive:true});writeFileSync(p,bytes);}}}={}){
 const paths=[eManifest,fManifest,'docs/SumAlpha-QuantOS-Development-Plan.md','docs/SumAlpha-QuantOS-Frontend-Development-Execution-Plan.md'],before=new Map(paths.map(p=>[p,read(p)]));
 try{publishFirst(eIndex);publishSecond(fIndex);const result=verify();assert.equal(result[0].observedSourceCommit,result[1].observedSourceCommit,'E/F source differs');return result;}catch(error){for(const [p,bytes]of before)write(p,bytes);throw error;}
}
