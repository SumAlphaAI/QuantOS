import { bffZodSchemas, type BffComponents, type SseEventEnvelope } from '@sumalpha/api-client';
import type { RouteContext } from '../auth/route-access';
import { decimal } from '../portfolio/policy';
export type Proposal = BffComponents['schemas']['TradeProposal'];
export type Preflight = BffComponents['schemas']['TradePreflight'];
export const proposalPolicy = { pollMs:2000, maxUnverifiedMs:8000, maxAgeMs:60000, pageSize:50, maxRows:1000, frameChars:262144 } as const;
export const proposalStatuses=['active','awaiting_approval','approved','command_ready','request_info','rejected','expired','submitted'] as const;
export type ProposalQuery={status?:typeof proposalStatuses[number];symbol?:string};
export const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][0-9a-f]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function proposalRoute(path:string,search=''):string|undefined {
  if(search)throw Error('Unexpected query');if(path==='/proposals')return;
  const parts=path.split('/');if(parts.length!==3||parts[0]!==''||parts[1]!=='proposals'||!uuid.test(parts[2]))throw Error('Invalid proposal route');return parts[2].toLowerCase();
}
export function proposalHref(id:string){if(!uuid.test(id))throw Error('Invalid proposal reference');return '/proposals/'+id.toLowerCase();}
export function queryInput(raw:ProposalQuery):ProposalQuery {
  if(raw.status!==undefined&&!proposalStatuses.includes(raw.status))throw Error('Invalid status');
  if(raw.symbol!==undefined&&!/^[A-Z0-9][A-Z0-9/._:-]{0,99}$/.test(raw.symbol))throw Error('Invalid symbol');
  return {...raw.status?{status:raw.status}:{},...raw.symbol?{symbol:raw.symbol}:{}};
}
function ratio(raw:string){decimal(raw,true);const [units,fraction='']=raw.split('.');if(BigInt(units)>1n||BigInt(units)===1n&&/[1-9]/.test(fraction))throw Error('Invalid confidence');}
export function proposal(raw:unknown,accountId:string,id?:string,now=Date.now()):Proposal {
  const p=bffZodSchemas.TradeProposal.strict().parse(raw);p.signal=bffZodSchemas.Signal.strict().parse(p.signal);
  if(p.accountId!==accountId||id&&p.proposalId!==id||!Number.isFinite(now)||!p.symbol||p.symbol.length>100||p.signal.symbol!==p.symbol||!p.objectVersion.trim()||p.objectVersion.length>200||!p.rationale.trim()||p.rationale.length>20000||p.counterViews.length>30||p.counterViews.some(v=>!v.trim()||v.length>4000)||p.evidenceRefs.length>100||new Set(p.evidenceRefs).size!==p.evidenceRefs.length||Date.parse(p.signal.generatedAt)>now||Date.parse(p.signal.generatedAt)>=Date.parse(p.signal.validUntil)||Date.parse(p.expiresAt)>Date.parse(p.signal.validUntil))throw Error('Proposal scope/consistency mismatch');
  decimal(p.quantity,true);if(!/[1-9]/.test(p.quantity))throw Error('Zero quantity');decimal(p.notional,true);decimal(p.signal.strength);ratio(p.confidence);ratio(p.signal.confidence);
  return structuredClone(p);
}
export function alive(p:Proposal|undefined,now=Date.now()){return !!p&&Number.isFinite(now)&&now<Date.parse(p.expiresAt)&&now<Date.parse(p.signal.validUntil)&&p.status!=='expired';}
export function preflight(raw:unknown,p:Proposal,context:RouteContext,now=Date.now()):Preflight {
  const q=bffZodSchemas.TradePreflight.strict().parse(raw);
  if(q.proposalId!==p.proposalId||q.accountId!==p.accountId||q.accountId!==context.accountId||q.mode!==context.mode||q.objectVersion!==p.objectVersion||p.correlationId&&q.correlationId&&p.correlationId!==q.correlationId||!/^sha256:[a-f0-9]{64}$/.test(q.contextHash)||Date.parse(q.asOf)>now||Date.parse(q.expiresAt)>Math.min(Date.parse(p.expiresAt),Date.parse(p.signal.validUntil))||q.hitRules.length>100||q.hitRules.some(v=>!v||v.length>200)||new Set(q.hitRules).size!==q.hitRules.length)throw Error('Risk context mismatch');
  return structuredClone(q);
}
export function currentPreflight(q:Preflight|undefined,p:Proposal|undefined,now=Date.now()) {return !!q&&alive(p,now)&&Date.parse(q.asOf)<=now&&now-Date.parse(q.asOf)<proposalPolicy.maxAgeMs&&Date.parse(q.expiresAt)>now&&q.verdict!=='deny';}
export function identity(p:Proposal){const {status:_status,correlationId:_correlation,...rest}=p;void _status;void _correlation;return JSON.stringify(rest);}
const rank={active:0,awaiting_approval:1,approved:2,command_ready:3,submitted:4,request_info:5,rejected:5,expired:6};
export class ProposalFacts {
  private value?:Proposal;private sequence=0;private stream?:string;private closed=false;
  constructor(readonly accountId:string,readonly proposalId:string){bffZodSchemas.UUID.parse(accountId);bffZodSchemas.UUID.parse(proposalId);}
  get current(){return this.value&&structuredClone(this.value);}get afterSequence(){return this.sequence;}
  revoke(){this.closed=true;this.value=undefined;this.sequence=0;this.stream=undefined;}
  apply(raw:SseEventEnvelope,now=Date.now()){
    if(this.closed)throw Error('Proposal revoked');const e=bffZodSchemas.StreamEvent.parse(raw);
    if(e.payload.type==='permission_revoked'){this.revoke();throw Object.assign(Error('Proposal revoked'),{status:403});}
    if(this.stream&&this.stream!==e.streamId||!Number.isSafeInteger(e.sequence)||e.sequence<1)throw Error('Proposal lease mismatch');
    const p=proposal(e.payload,this.accountId,this.proposalId,now);if(p.correlationId&&p.correlationId!==e.correlationId)throw Error('Proposal correlation mismatch');
    if(e.sequence<=this.sequence)return false;if(e.sequence!==this.sequence+1)throw Error('Proposal stream gap');
    if(this.value&&p.objectVersion===this.value.objectVersion&&(identity(p)!==identity(this.value)||p.status&&this.value.status&&rank[p.status]<rank[this.value.status]))throw Error('Proposal fact regressed');
    this.value=p;this.sequence=e.sequence;this.stream=e.streamId;return true;
  }
}
