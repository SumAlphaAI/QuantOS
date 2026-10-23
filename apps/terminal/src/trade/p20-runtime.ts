import {bffZodSchemas,createBffClient,type BffComponents} from '@sumalpha/api-client';
import {createTicketRuntime,TicketError} from './runtime';
import {createProposalRuntime} from '../proposals/runtime';
import {createOrdersRuntime} from '../orders/runtime';
import {identity} from '../proposals/policy';
import type {RouteContext} from '../auth/route-access';
import type {TicketLocation} from './p20-presentation';
type Approval=BffComponents['schemas']['Approval'];
type Config=Parameters<typeof createOrdersRuntime>[0];
/** Compose existing owners without granting one stage the authority of the next. */
export function createControlledTicket(config:Config){
 const now=config.now??Date.now,life=new AbortController(),client=createBffClient({baseUrl:config.origin,fetch:config.fetchImpl,signal:life.signal,timeoutMs:5000});
 const ticket=createTicketRuntime(config),risk=createProposalRuntime(config),commands=createOrdersRuntime(config),listeners=new Set<()=>void>();
 let context:RouteContext|undefined,busy=false,closed=false,approval:Approval|undefined,verifiedUntil=0,retryAt=0;
 const emit=()=>listeners.forEach(f=>f()),off=[ticket.subscribe(emit),risk.subscribe(emit),commands.subscribe(emit)];
 function guard(){config.authorize();if(closed||!context||!config.online()||now()>=Date.parse(context.expiresAt))throw new TicketError(403,'FORBIDDEN');}
 const unknown=()=>!!risk.view.pending||!!commands.view.pending;
 async function exclusive(fn:()=>Promise<void>,recover=false){guard();if(busy)throw new TicketError(409,'BUSY');if(now()<retryAt)throw new TicketError(429,'RATE_LIMITED');if(unknown()&&!recover)throw new TicketError(409,'RECOVERY_REQUIRED');busy=true;emit();try{await fn();guard();}catch(e){verifiedUntil=0;throw e;}finally{busy=false;emit();}}
 // Source runtimes are never rebound to another proposal while there is an unresolved write.
 async function matchApproval(){
  guard();await risk.open(ticket.view.selectedId!);const p=risk.view.selected!,reviewed=ticket.view.snapshot?.proposal;
  if(!reviewed||identity(p)!==identity(reviewed))throw new TicketError(409,'SOURCE_CHANGED');
  if(!['awaiting_approval','approved','command_ready','rejected','request_info','submitted'].includes(p.status??''))throw new TicketError(409,'EVALUATION_REQUIRED');
  const all:Approval[]=[],seen=new Set<string>();let cursor:string|undefined;
  do{const r=await client.GET('/v1/approvals',{params:{query:{pageSize:50,...cursor?{cursor}:{}}},cache:'no-store'});guard();
   if(r.response.status!==200){if([401,403].includes(r.response.status))config.invalidate(r.response.status);const e=bffZodSchemas.ErrorEnvelope.safeParse(r.error);if(r.response.status===429)retryAt=now()+Math.min(Math.max(e.success?e.data.retryAfter??60:60,1),3600)*1000;throw new TicketError(r.response.status,e.success?e.data.code:'UNAVAILABLE',e.success?e.data.correlationId:undefined);}
   const page=bffZodSchemas.Page.parse(r.data);if(page.items.length>50||all.length+page.items.length>1000||page.nextCursor&&(seen.has(page.nextCursor)||page.nextCursor.length>2048))throw new TicketError(502,'INVALID_PAGE');
   all.push(...page.items.map(v=>bffZodSchemas.Approval.parse(v)));cursor=page.nextCursor;if(cursor)seen.add(cursor);
  }while(cursor);
  const found=all.filter(a=>a.correlationId===p.correlationId&&a.originator===context!.actorId&&a.kind!=='strategy_release');
  if(new Set(all.map(a=>a.approvalId)).size!==all.length||found.length!==1)throw new TicketError(409,'APPROVAL_UNRESOLVED');
  const a=found[0];if(a.objectRef&&a.objectRef!==p.proposalId)throw new TicketError(502,'SOURCE_CHANGED');
  approval=a;verifiedUntil=now()+8000;
  if(p.status!=='submitted'&&a.status==='approved'&&a.commandRef&&a.commandExpiresAt&&now()<Date.parse(a.commandExpiresAt)&&now()<Date.parse(a.expiresAt)){
   await commands.prepare(a.approvalId);const fresh=commands.view.approval;
   if(!fresh||fresh.correlationId!==p.correlationId||fresh.approvalId!==a.approvalId)throw new TicketError(409,'SOURCE_CHANGED');approval=fresh;
  }
 }
 return{
  ticket,risk,commands,
  async load(){context=await ticket.load();await risk.load();await commands.load();guard();return structuredClone(context);},
  subscribe(f:()=>void){listeners.add(f);return()=>{listeners.delete(f);};},
  get view(){const t=ticket.view,r=risk.view,c=commands.view;const currentApproval=!!approval&&now()<verifiedUntil&&now()<Date.parse(approval.expiresAt);return {ticket:t,risk:r,commands:c,approval:approval&&structuredClone(approval),busy:busy||t.busy||r.busy||c.busy,retryAt,unknown:unknown(),approvalCurrent:currentApproval,canSubmit:!busy&&!unknown()&&currentApproval&&['approved','command_ready'].includes(r.selected?.status??'')&&approval?.status==='approved'&&!!approval.commandExpiresAt&&now()<Date.parse(approval.commandExpiresAt)&&c.canSubmit&&!c.receipt,stage:c.receipt?4:approval?.status==='approved'?4:approval||r.receipt?3:2};},
  list(){return exclusive(()=>ticket.list());},
  select(id:string,instrument?:string,location?:TicketLocation){return exclusive(async()=>{
   // Resetting selection cannot reuse a previous risk request, approval, or command receipt.
   if(ticket.view.selectedId&&ticket.view.selectedId!==id)throw new TicketError(409,'REOPEN_TICKET');
   approval=undefined;verifiedUntil=0;await ticket.select(id,instrument);
   if(location?.symbol&&ticket.view.snapshot?.proposal.symbol!==location.symbol){ticket.reset();throw new TicketError(409,'SYMBOL_MISMATCH');}
  });},
  advance(){return exclusive(()=>ticket.advance());},
  evaluate(phrase:string){return exclusive(async()=>{
   if(phrase!=='EVALUATE RISK'||ticket.view.step!==3)throw new TicketError(409,'REVIEW_REQUIRED');
   await ticket.advance();const t=ticket.view;if(!t.current||!t.draft||!t.snapshot)throw new TicketError(409,'SOURCE_CHANGED');
   await risk.open(t.snapshot.proposal.proposalId);await risk.prepare();const r=risk.view;
   if(!r.selected||identity(r.selected)!==identity(t.snapshot.proposal)||r.preview?.contextHash!==t.snapshot.preflight.contextHash)throw new TicketError(409,'SOURCE_CHANGED');
   await risk.evaluate();await matchApproval();
  });},
  refreshApproval(){return exclusive(async()=>{approval=undefined;verifiedUntil=0;if(!ticket.view.selectedId)throw new TicketError(409,'SELECT_PROPOSAL');await matchApproval();});},
  submit(phrase:string){return exclusive(async()=>{if(phrase!=='SUBMIT COMMAND'||!approval||now()>=verifiedUntil)throw new TicketError(409,'REVIEW_REQUIRED');const reviewed=approval;await matchApproval();
   if(approval?.approvalId!==reviewed.approvalId||approval?.commandRef!==reviewed.commandRef||approval?.commandExpiresAt!==reviewed.commandExpiresAt||approval?.objectVersion!==reviewed.objectVersion)throw new TicketError(409,'SOURCE_CHANGED');await commands.submit(phrase);
  });},
  recover(){return exclusive(async()=>{if(commands.view.pending)await commands.retry();else if(risk.view.pending){await risk.prepare();await risk.retry();await matchApproval();}else throw new TicketError(409,'NO_PENDING');},true);},
  close(){closed=true;life.abort();off.forEach(f=>f());ticket.close();risk.close();commands.close();context=undefined;approval=undefined;verifiedUntil=0;listeners.clear();}
 };
}
export type ControlledTicket=ReturnType<typeof createControlledTicket>;
