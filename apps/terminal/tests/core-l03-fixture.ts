// Explicit client response model only; not BFF/F06/native/HMAC or database proof.
import {createAssistedRuntime} from '../src/assisted/runtime';
import type {BffComponents} from '@sumalpha/api-client';
type S=BffComponents['schemas'];
const id=(i:number)=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0');
export function assistedModel(role:'operator'|'approver'='operator'){
 let time=Date.parse('2026-10-27T00:00:00Z'),csrf='model-original-csrf',online=true,desktop=true,authorizer=true,drop=false,refusal=0,rotate=false,readRefusal=0,commits=0,enabled=true,activationPaused=false,invalidCaps=false;
 const stamp=(ms:number)=>new Date(ms).toISOString(),invalidations:number[]=[],requests:Request[]=[],cache=new Map<string,unknown>();
 const context={actorId:id(role==='operator'?1:2),tenantId:id(3),workspaceId:id(4),accountId:id(5),mode:'assisted_live' as const,environment:'dev' as const,capabilities:['execution.operate','execution.assisted_testnet',...role==='approver'?['strategy.approve']:[]],mfaState:'verified' as const,expiresAt:stamp(time+300000)};
 const subject:S['AssistedSubject']={subjectId:id(6),subjectHash:'sha256:'+'a'.repeat(64),proposalHash:'sha256:'+'b'.repeat(64),decisionId:id(7),originator:id(1),accountId:id(5),symbol:'BTCUSDT',side:'buy',quantity:'1',limitPrice:'1000',expiresAt:stamp(time+180000)};
 let row:S['AssistedRequestView']={subject,request:{requesterId:id(1),requestId:id(8),subjectId:subject.subjectId,subjectHash:subject.subjectHash,policyVersion:'1',revision:role==='operator'?2:0,status:role==='operator'?'approved':'pending',approvers:role==='operator'?[id(2),id(9)]:[],expiresAt:stamp(time+120000),notional:'1000',executionAuthority:false}};
 let reconciliation:S['AssistedReconciliationView']|undefined,reconEnabled=false;
 const runtime=createAssistedRuntime({origin:'https://fixture.invalid',authorize:()=>{if(!authorizer)throw Error('model revoked');},online:()=>online,writeAllowed:()=>desktop,csrf:()=>csrf,now:()=>time,invalidate:s=>invalidations.push(s),fetchImpl:async(input,init)=>{
 const req=new Request(input,init),url=new URL(req.url),path=url.pathname;if(url.origin!=='https://fixture.invalid')throw Error('model refuses external IO');requests.push(req.clone());
 if(path==='/v1/session'||path==='/v1/context')return refusal?new Response('<html>denied</html>',{status:refusal,headers:{'content-type':'text/html'}}):Response.json(context);
 if(path.endsWith('/capabilities'))return Response.json({reconciliationReaderEnabled:reconEnabled,schemaVersion:'quantos-assisted-testnet-capabilities.v1',actorId:context.actorId,tenantId:context.tenantId,workspaceId:invalidCaps?id(99):context.workspaceId,accountId:context.accountId,mode:context.mode,serverFlagEnabled:enabled,targetEnabled:enabled||activationPaused,canRequest:role==='operator',canApprove:role==='approver',executionAuthority:false,policyVersion:'core-l03-local.v1',policyRevision:1,checkedAt:stamp(time),expiresAt:stamp(time+8000)});
 if(path==='/v1/assisted-testnet/reconciliation')return reconciliation?Response.json(reconciliation):Response.json({code:'UNAVAILABLE'},{status:503});
 if(path.endsWith('/subjects'))return Response.json({items:[subject]});
 if(path==='/v1/auth/mfa/challenges'){if(rotate)csrf='model-replacement-csrf';return Response.json({challengeRef:id(10),status:(await req.clone().json()).code==='123456'?'verified':'failed'});}
 if(path==='/v1/auth/reauth')return Response.json({reauthTokenRef:id(11),expiresAt:stamp(time+120000)});
 if(req.method==='GET'&&readRefusal)return Response.json({code:'UNAVAILABLE'},{status:readRefusal});
 if(req.method==='GET')return Response.json(path==='/v1/assisted-testnet/requests'?{items:[row]}:row);
 const key=req.headers.get('idempotency-key')!,old=cache.get(key);if(old)return Response.json(old);let payload:unknown;
 if(path.endsWith('/commands')){commits++;row={...row,command:{requestId:row.request.requestId,subjectHash:subject.subjectHash,commandId:id(12),expiresAt:stamp(time+30000),state:'accepted',signature:'c'.repeat(64),order:{orderId:'order-model',commandId:id(12),accountId:context.accountId,symbol:subject.symbol,side:subject.side,quantity:subject.quantity,filledQuantity:'0',status:'accepted'}}};payload=row.command;}
 else if(path.endsWith('/approvals')){commits++;row={...row,request:{...row.request,revision:row.request.revision+1,status:'awaiting_second',approvers:[id(2)]}};payload=row;}
 else{commits++;payload=row;}
 cache.set(key,globalThis.structuredClone(payload));if(drop){drop=false;throw Error('EXPLICIT_MODEL_COMMITTED_RESPONSE_LOSS');}return Response.json(payload);
 }});
 return{runtime,context,subject,requests,invalidations,get commits(){return commits;},setReconciliation(v:S['AssistedReconciliationView']){reconciliation=v;reconEnabled=true;},setLedger(ledger:S['AssistedLedgerReceipt']|undefined){row={...row,ledger};},setFacts(facts:S['AssistedExecutionFacts']|undefined){row={...row,facts};},async init(){await runtime.refresh();await runtime.select(id(8));},lose(){drop=true;},rotateCsrf(){csrf='replacement-csrf';},rotateDuringMfa(){rotate=true;},advance(ms:number){time+=ms;},refuse(code:number){refusal=code;},refuseReads(code:number){readRefusal=code;},offline(){online=false;},phone(){desktop=false;},revokeAuthorizer(){authorizer=false;},disable(){enabled=false;},pauseActivation(){activationPaused=true;enabled=false;},foreignCaps(){invalidCaps=true;},expireRequest(){row.request.expiresAt=stamp(time);},changePolicy(){row.request.policyVersion='2';},close(){runtime.close();}};
}
