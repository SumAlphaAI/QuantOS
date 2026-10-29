import {expect,it} from 'vitest';
import {nativeReviewModel} from './native-review-fixture';
it('current Command must retain the Subject account-books binding',async()=>{const m=nativeReviewModel(true);try{m.adoptNativeReview();m.enableCurrentExecution();await m.init();m.corruptBooksBinding();await expect(m.runtime.submit()).rejects.toThrow('INVALID_NATIVE_REVIEW');expect(m.runtime.view.selected?.command).toBeUndefined();}finally{m.close();}});
const commands=(m:ReturnType<typeof nativeReviewModel>)=>m.requests.filter(r=>r.method==='POST'&&r.url.endsWith('/commands'));
it('explicit current execution requires owner admission and validates immutable current binding',async()=>{
 const m=nativeReviewModel(true);try{m.adoptNativeReview();m.enableCurrentExecution();await m.init();expect(m.runtime.view.canSubmit).toBe(true);expect(commands(m)).toHaveLength(0);await m.runtime.submit();expect(m.runtime.view.selected?.command?.currentRisk?.snapshotHash).toBe(m.review.snapshotHash);expect(commands(m)).toHaveLength(1);expect(m.runtime.view.canSubmit).toBe(false);}finally{m.close();}
});
it('current execution lost response recovers through GET only after source advances',async()=>{
 const m=nativeReviewModel(true);try{m.adoptNativeReview();m.enableCurrentExecution();await m.init();m.lose();await expect(m.runtime.submit()).rejects.toThrow();m.valuation.riskInputReady=false;delete m.valuation.snapshot;await m.runtime.retry();expect(m.runtime.view.selected?.command?.state).toBe('accepted');expect(commands(m)).toHaveLength(1);expect(m.runtime.view.pending).toBeUndefined();}finally{m.close();}
});
it('UNKNOWN current execution is query only and never emits a second POST',async()=>{
 const m=nativeReviewModel(true);try{m.adoptNativeReview();m.enableCurrentExecution();m.unknownCurrentCommand();await m.init();await m.runtime.submit();expect(m.runtime.view.status).toBe('unknown');expect(m.runtime.view.canRecover).toBe(false);await m.runtime.retry();expect(commands(m)).toHaveLength(1);expect(m.runtime.view.pending).toBeUndefined();await expect(m.runtime.submit()).rejects.toThrow();expect(commands(m)).toHaveLength(1);}finally{m.close();}
});
it('foreign current command binding never becomes a trusted receipt',async()=>{
 const m=nativeReviewModel(true);try{m.adoptNativeReview();m.enableCurrentExecution();m.corruptCurrentBinding();await m.init();await expect(m.runtime.submit()).rejects.toThrow('INVALID_NATIVE_REVIEW');expect(m.runtime.view.selected?.command).toBeUndefined();expect(commands(m)).toHaveLength(1);}finally{m.close();}
});
for(const kind of ['source','generation','phone','csrf']as const)it('current '+kind+' change refuses dispatch',async()=>{
 const m=nativeReviewModel(true);try{m.adoptNativeReview();m.enableCurrentExecution();await m.init();if(kind==='source'){m.valuation.sourceVersion='2';m.valuation.snapshot.sourceVersion=2;}if(kind==='generation')m.valuation.killGeneration='1';if(kind==='phone')m.phone();if(kind==='csrf'){m.lose();await expect(m.runtime.submit()).rejects.toThrow();m.rotateCsrf();await expect(m.runtime.retry()).rejects.toThrow();expect(commands(m)).toHaveLength(1);return;}await expect(m.runtime.submit()).rejects.toThrow();expect(commands(m)).toHaveLength(0);}finally{m.close();}
});
// Captured owned public response regression model; no market/identity/IO authority.
it('actual owned current Command/Fill/ledger response retains the immutable receipt binding',async()=>{
 const {default:v}=await import('./fixtures/current-native-observed.json');const {createAssistedRuntime}=await import('../src/assisted/runtime');
 const context={actorId:v.subject.originator,tenantId:v.facts.tenantId,workspaceId:v.facts.workspaceId,accountId:v.subject.accountId,mode:'assisted_live',environment:'dev',capabilities:['execution.operate','execution.assisted_testnet'],mfaState:'verified',expiresAt:v.request.expiresAt};
 const at=Date.parse(v.command.expiresAt)-10000;
 const r=createAssistedRuntime({origin:'https://fixture.invalid',authorize:()=>{},online:()=>true,csrf:()=>'',invalidate:()=>{},writeAllowed:()=>true,now:()=>at,fetchImpl:async(i)=>{const p=new URL(i instanceof Request?i.url:String(i)).pathname;if(p==='/v1/session'||p==='/v1/context')return Response.json(context);if(p.endsWith('/capabilities'))return Response.json({schemaVersion:'quantos-assisted-testnet-capabilities.v1',actorId:context.actorId,tenantId:context.tenantId,workspaceId:context.workspaceId,accountId:context.accountId,mode:context.mode,serverFlagEnabled:true,targetEnabled:true,currentReviewExecutionEnabled:true,canRequest:true,canApprove:false,executionAuthority:false,policyVersion:'core-l03-local.v1',policyRevision:1,checkedAt:new Date(at).toISOString(),expiresAt:new Date(at+8000).toISOString()});if(p.endsWith('/subjects'))return Response.json({items:[]});return Response.json({items:[v]});}});
 try{await r.refresh();expect(r.view.rows[0]?.command?.currentRisk?.snapshotHash).toBe(v.command.currentRisk.snapshotHash);}finally{r.close();}
});
it('current execution admission never reopens an old Subject after a new Deny',async()=>{
 const m=nativeReviewModel(false);try{m.enableCurrentExecution();await m.init();await m.runtime.risk!.prepare(m.candidate.subjectId);await m.runtime.risk!.evaluate();expect(m.runtime.view.selected?.subject.nativeRiskBinding).toBeUndefined();expect(m.runtime.view.canSubmit).toBe(false);await expect(m.runtime.submit()).rejects.toThrow('NATIVE_REVIEW_EXECUTION_DENIED');expect(commands(m)).toHaveLength(0);}finally{m.close();}
});
