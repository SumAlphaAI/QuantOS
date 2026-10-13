// Actual current evidence probes; mutate only the new attempt, restore exact bytes in finally.
import assert from 'node:assert/strict';import{readFileSync,writeFileSync}from'node:fs';
import{verify,verifyPublished,manifest,releaseCheck}from'../../../../scripts/tp02-local-gate.mjs';
import{digest}from'../../../../scripts/provider-a1-receipts.mjs';
const wrapper=JSON.parse(readFileSync(manifest)),indexPath=wrapper.localPrerequisites.manifest,index=JSON.parse(readFileSync(indexPath)),own=index.nodes.at(-1),ownPath=own.manifest,original=JSON.parse(readFileSync(ownPath));
const component=original.checks.find(c=>c.id==='tp02-development'),rawComponent=JSON.parse(readFileSync(component.artifact)),wheel=component.artifact.replace(/[^/]+$/,'wheels/'+rawComponent.package.wheels[0].file),log=component.log;
const backups=new Map([indexPath,ownPath,wheel,log].map(path=>[path,readFileSync(path)]));const results=[];
const restore=()=>{for(const[path,bytes]of backups)writeFileSync(path,bytes);};
function rejects(name,action,pattern){let message;try{action();}catch(e){message=e.message;}finally{restore();}assert(message,name+' unexpectedly passed');assert.match(message,pattern);for(const[path,bytes]of backups)assert.deepEqual(readFileSync(path),bytes);results.push({name,status:'PASS',rejection:message.split('\n')[0]});}
try{
 assert.equal(verifyPublished().stageGate,'READY');
 for(const[name,change,pattern]of[
  ['formal escalation',r=>r.formalAccepted=true,/false/],['production escalation',r=>r.production=true,/false/],['database escalation',r=>r.databaseExecution=true,/false/],
  ['foreign profile',r=>r.profile='R1_LOCAL',/TP02_LOCAL/],['foreign consumer',r=>r.nodeId='CORE-GATE:R1-SERVICE',/CORE:TP02/],
  ['different candidate',r=>r.observedSourceCommit='a'.repeat(40),/mixed candidates/],['substituted index digest',r=>r.localPrerequisites.inputDigest=digest('other'),/index digest/],
  ['missing dependency',r=>r.dependencies.pop(),/dependency proof/],['strict READY alias',r=>r.dependencies[0].status='READY',/dependency proof/],
  ['waived release',r=>r.release.prerequisiteChecks.pop(),/deferred obligations/],['target PASS',r=>r.release.status='PASS',/NOT_RUN/],
 ])rejects(name,()=>{const r=structuredClone(wrapper);change(r);verify(r);},pattern);
 for(const[name,change,pattern]of[
  ['missing complete closure',r=>r.nodes.pop(),/deep-equal/],['duplicate closure',r=>r.nodes[0]=r.nodes[1],/deep-equal/],
  ['foreign index owner',r=>r.owner='CORE:R03',/CORE:TP02/],['foreign index profile',r=>r.profile='R03_LOCAL',/TP02_LOCAL/],
  ['different index SHA',r=>r.observedSourceCommit='b'.repeat(40),/execution SHA/],['deferred SCA waived',r=>r.deferred=r.deferred.filter(c=>c.id!=='f02-sca'),/f02-sca/],
 ])rejects(name,()=>{const r=structuredClone(index);change(r);writeFileSync(indexPath,JSON.stringify(r));verify(wrapper);},pattern);
 for(const[name,change,pattern]of[
  ['hidden timeout',r=>r.checks[0].timedOut=true,/abnormal execution/],['hidden signal',r=>r.checks[0].signal='SIGTERM',/abnormal execution/],
  ['hidden spawn error',r=>r.checks[0].executionErrorCode='ETIMEDOUT',/abnormal execution/],['missing execution',r=>r.checks.pop(),/required functional checks/],
  ['command substitution',r=>r.checks[0].command=['true'],/actual command/],['candidate splice',r=>r.observedSourceCommit='c'.repeat(40),/execution SHA/],
 ])rejects(name,()=>{const m=structuredClone(original);change(m);const bytes=JSON.stringify(m),idx=structuredClone(index);writeFileSync(ownPath,bytes);idx.nodes.at(-1).inputDigest=digest(bytes);const indexBytes=JSON.stringify(idx);writeFileSync(indexPath,indexBytes);const r=structuredClone(wrapper);r.localPrerequisites.inputDigest=digest(indexBytes);r.functionalDigest=digest(bytes);verify(r);},pattern);
 rejects('wheel bytes substituted',()=>{writeFileSync(wheel,'substituted wheel');verify(wrapper);},/TP02 wheel changed/);
 rejects('raw component log replaced',()=>{writeFileSync(log,'engineeringStatus PASS');verify(wrapper);},/log content changed/);
 rejects('release with local evidence',()=>releaseCheck(),/NOT_RUN/);
}finally{restore();}
assert.equal(verifyPublished().stageGate,'READY');
writeFileSync(process.argv[2],JSON.stringify({schema:'quantos-tp02-actual-evidence-probes/v1',status:'PASS',observedSourceCommit:wrapper.observedSourceCommit,cases:results.length,restored:true,formalAccepted:false,results},null,2)+'\n');console.log(JSON.stringify({status:'PASS',cases:results.length,restored:true,formalAccepted:false}));
