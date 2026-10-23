import {bffZodSchemas,type BffComponents} from '@sumalpha/api-client';
import {alive,type Proposal} from './policy';
export type ProposalTab='all'|'active'|'expiring'|'evaluated'|'expired';
export type ProposalView={tab:ProposalTab;search:string;release:string;sort:'expiry:asc'|'expiry:desc'};
export const defaultProposalView:ProposalView={tab:'all',search:'',release:'',sort:'expiry:asc'};
export const tabs:[ProposalTab,string][]=[['all','全部'],['active','Active'],['expiring','Expiring'],['evaluated','Evaluated'],['expired','Expired']];
export function inTab(p:Proposal,tab:ProposalTab,now:number){const current=alive(p,now);return tab==='all'||tab==='expired'&&!current||tab==='active'&&current&&p.status==='active'||tab==='expiring'&&current&&p.status==='active'&&Date.parse(p.expiresAt)-now<=120000||tab==='evaluated'&&current&&!!p.status&&p.status!=='active';}
export function visibleProposals(rows:Proposal[],view:ProposalView,now:number){const search=view.search.trim().toLowerCase().slice(0,200);return rows.filter(p=>inTab(p,view.tab,now)&&(!view.release||p.signal.strategyReleaseId===view.release)&&(!search||[p.proposalId,p.symbol,p.signal.strategyReleaseId].some(v=>v.toLowerCase().includes(search)))).toSorted((a,b)=>(Date.parse(a.expiresAt)-Date.parse(b.expiresAt))*(view.sort==='expiry:asc'?1:-1)||a.proposalId.localeCompare(b.proposalId));}
export function expiryText(p:Proposal,now:number){if(!alive(p,now))return '已过期，禁止评估';const seconds=Math.max(0,Math.ceil((Math.min(Date.parse(p.expiresAt),Date.parse(p.signal.validUntil))-now)/1000));return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')} 后失效`;}
export function proposalState(p:Proposal,now:number){return !alive(p,now)?'expired':p.status??'unknown';}
export const short=(v:string,length=12)=>v.length>length?v.slice(0,length)+'…':v;
export const utc=(v:string)=>new Date(v).toISOString().replace('T',' ').replace('Z',' UTC');
export type ProposalChain=BffComponents['schemas']['EvidenceChainPage'];
export function checkedChain(raw:unknown,correlation:string,previous:ProposalChain|undefined,now:number):ProposalChain{
 const p=bffZodSchemas.EvidenceChainPage.strict().parse(raw);p.items=p.items.map(v=>bffZodSchemas.EvidenceNode.strict().parse(v));
 if(p.correlationId!==correlation||p.items.length>100||p.complete&&p.nextCursor||!p.complete&&!p.nextCursor||p.nextCursor&&(!p.nextCursor.trim()||p.nextCursor.length>512))throw Error('Invalid evidence scope/page');
 const items=[...previous?.items??[],...p.items];if(items.length>2000||new Set(items.map(i=>i.eventId)).size!==items.length||items.some((v,i)=>!Number.isSafeInteger(v.sequence)||v.sequence<1||i>0&&v.sequence<=items[i-1].sequence||Date.parse(v.retentionUntil)<=now||Date.parse(v.occurredAt)>now||v.kind.length>200||v.objectRef.length>2048||v.route.length>2048))throw Error('Invalid evidence ordering/retention/bounds');
 return structuredClone({...p,items});
}
