import type { Portfolio, Snapshot } from './policy';
export type PortfolioLocation = { kind:'portfolio'|'risk' } | { kind:'rule'; ruleId:string };
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function portfolioLocation(path:string,search=''):PortfolioLocation {
  if(search)throw Error('Unexpected portfolio query');
  if(path==='/portfolio')return {kind:'portfolio'};
  if(path==='/risk')return {kind:'risk'};
  const parts=path.split('/');
  if(parts.length===4&&parts[0]===''&&parts[1]==='risk'&&parts[2]==='rules'&&uuid.test(parts[3]))return {kind:'rule',ruleId:parts[3].toLowerCase()};
  throw Error('Invalid portfolio route');
}
export function ruleHref(ruleId:string) { if(!uuid.test(ruleId))throw Error('Invalid risk reference'); return '/risk/rules/'+ruleId.toLowerCase(); }
export function selectedRule(pair:Snapshot|undefined,route:PortfolioLocation) {
  if(!pair||route.kind!=='rule')return undefined;
  const index=pair.risk.limitIds.findIndex(id=>id.toLowerCase()===route.ruleId);
  return index<0?undefined:{name:pair.risk.hitRules[index],limitId:pair.risk.limitIds[index],asOf:pair.risk.asOf,objectVersion:pair.risk.objectVersion,accountId:pair.risk.accountId};
}
export type PortfolioView={search:string;side:'all'|'long'|'short';sort:'symbol:asc'|'symbol:desc';compact:boolean};
export const portfolioViewKey='quantos.portfolio.layout.v1';
export const defaultPortfolioView:PortfolioView={search:'',side:'all',sort:'symbol:asc',compact:false};
export function parsePortfolioView(raw:string|null):PortfolioView {
  try {const v=JSON.parse(raw??'null');if(v&&typeof v.search==='string'&&v.search.length<=60&&['all','long','short'].includes(v.side)&&['symbol:asc','symbol:desc'].includes(v.sort)&&typeof v.compact==='boolean')return {search:v.search,side:v.side,sort:v.sort,compact:v.compact};} catch { /* Layout is optional and never authority. */ }
  return {...defaultPortfolioView};
}
export function filterPositions(rows:Portfolio['positions'],view:PortfolioView) {
  const query=view.search.trim().toLowerCase();
  return rows.filter(p=>(!query||p.symbol.toLowerCase().includes(query))&&(view.side==='all'||p.side===view.side)).toSorted((a,b)=>a.symbol.localeCompare(b.symbol)*(view.sort==='symbol:asc'?1:-1));
}
/** Observed snapshots only: asOf is a source snapshot time, never a fabricated hit timestamp. */
export type RiskObservation={asOf:string;version:string;rules:{name:string;id:string}[];kill:'engaged'|'disengaged'};
export function observeRisk(history:RiskObservation[],pair:Snapshot):RiskObservation[] {
  const current={asOf:pair.risk.asOf,version:pair.risk.objectVersion!,rules:pair.risk.hitRules.map((name,i)=>({name,id:pair.risk.limitIds[i]})),kill:pair.risk.killSwitch.state};
  if(JSON.stringify(history[0])===JSON.stringify(current))return history;
  return [current,...history].slice(0,20);
}
