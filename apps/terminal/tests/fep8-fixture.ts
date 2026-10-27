// Explicit in-process C08 response model. No BFF/F06/crypto/dual-approval or database proof.
import {createApprovalRuntime,type ApprovalRuntime} from '../src/approvals/runtime';
import {opsContext,opsId,opsOther,opsNow} from './fixtures/scenarios/operations';
export function fep8Model(options:{passiveInvalidation?:boolean}={}){
 let now=opsNow,csrf='explicit-model-csrf',drop=false,commits=0,refusal=0,rotateAtMfa=false;
 const context={...structuredClone(opsContext),capabilities:['execution.operate','strategy.approve']},requests:Request[]=[],invalidations:number[]=[],replays=new Map<string,Response>();
 let current={approvalId:opsId,originator:opsOther,objectVersion:'0',status:'pending',expiresAt:new Date(now+60000).toISOString(),correlationId:opsId,issuanceState:'not_issued'};
 const runtime:ApprovalRuntime=createApprovalRuntime({origin:'https://fixture.invalid',authorize:()=>{},online:()=>true,csrf:()=>csrf,now:()=>now,invalidate:s=>{invalidations.push(s);if(!options.passiveInvalidation)runtime.close();},fetchImpl:async(i,n)=>{
  const req=new Request(i,n),u=new URL(req.url);if(u.origin!=='https://fixture.invalid')throw Error('No network in explicit model');requests.push(req.clone());
  if(u.pathname==='/v1/session'||u.pathname==='/v1/context')return refusal?new Response('<html>private refusal</html>',{status:refusal,headers:{'content-type':'text/html'}}):Response.json(context);
  if(u.pathname==='/v1/auth/mfa/challenges'){if(rotateAtMfa)csrf='replacement-model-csrf';return Response.json({challengeRef:opsOther,status:'verified'});}
  if(u.pathname==='/v1/auth/reauth')return Response.json({reauthTokenRef:opsId,expiresAt:new Date(now+30000).toISOString()});
  if(req.method==='GET')return Response.json(u.pathname==='/v1/approvals'?{items:[current]}:current);
  if(req.method==='POST'&&u.pathname===`/v1/approvals/${opsId}/decisions`){const key=req.headers.get('idempotency-key')!,old=replays.get(key);if(old)return old.clone();const body=await req.json();commits++;current={...current,objectVersion:'1',status:'approved',issuanceState:'consumed'};const response=Response.json({...current,decision:body.decision});replays.set(key,response.clone());if(drop){drop=false;throw Error('EXPLICIT_MODEL_COMMITTED_RESPONSE_LOSS');}return response;}
  throw Error('Unexpected model request '+req.method+' '+u.pathname);
 }});
 return{runtime,context,requests,invalidations,get commits(){return commits;},async init(){await runtime.load();await runtime.select(opsId);},act(){return runtime.act('approve','','CONFIRM APPROVE','123456');},loseNext(){drop=true;},rotateCsrf(){csrf='replacement-model-csrf';},rotateDuringMfa(){rotateAtMfa=true;},advance(ms:number){now+=ms;},refuse(s:number){refusal=s;},close(){runtime.close();}};
}
