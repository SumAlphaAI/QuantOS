import {uuid,type Run,type Break,type Entry} from './policy';
export type BreakTab='all'|'open'|'acknowledged'|'closed';
export type BreakView={tab:BreakTab;kind:string;search:string};
export const defaultBreakView:BreakView={tab:'all',kind:'',search:''};
export const breakTabs:[BreakTab,string][]=[['all','全部'],['open','待调查'],['acknowledged','已确认调查'],['closed','已解决']];
export const statusLabel=(s:Break['status'])=>({open:'待调查',acknowledged:'已确认调查',closed:'已解决'})[s];
export const breakTone=(s:Break['status'])=>s==='closed'?'good':s==='open'?'warning':'info';
export function visibleBreaks(rows:Break[],view:BreakView){const q=view.search.trim().toLowerCase().slice(0,200);return rows.filter(b=>(view.tab==='all'||b.status===view.tab)&&(!view.kind||b.kind===view.kind)&&(!q||[b.breakId,b.entity,b.kind,...b.evidenceRefs.map(e=>e.ref)].some(v=>v.toLowerCase().includes(q)))).toSorted((a,b)=>Date.parse(b.lastDetectedAt)-Date.parse(a.lastDetectedAt)||a.breakId.localeCompare(b.breakId));}
/** Summary counts cover returned exception records only; C15 does not expose matched/missing denominators. */
export function summary(r:Run|undefined,breaks:Break[]){return {matched:undefined,missing:undefined,reported:r?.breakCount,loaded:breaks.length,open:breaks.filter(b=>b.status==='open').length,acknowledged:breaks.filter(b=>b.status==='acknowledged').length,closed:breaks.filter(b=>b.status==='closed').length};}
export const short=(s:string,max=24)=>s.length>max?s.slice(0,max-1)+'…':s;
export const rawPreview=(s:string)=>short(s,65);
export const utc=(s:string)=>new Date(s).toISOString().replace('T',' ').replace('Z',' UTC');
export function breakHref(runId:string,breakId?:string){if(!uuid(runId)||breakId&&!/^sha256:[a-f0-9]{64}$/.test(breakId))throw Error('Invalid reconciliation reference');return '/reconciliation/'+runId+(breakId?'?breakId='+encodeURIComponent(breakId):'');}
export function orderRefs(rows:Run['evidenceRefs']){return rows.filter(r=>r.kind==='order'&&r.resolution==='source_record').map(r=>({...r,href:uuid(r.ref)?'/orders/'+r.ref:undefined}));}
export function sourceBooks(entries:Entry[]){return (['expected','actual'] as const).map(side=>({side,sources:[...new Set(entries.filter(e=>e.side===side).map(e=>e.sourceRef))],versions:[...new Set(entries.filter(e=>e.side===side).map(e=>e.ledgerVersion))],hashes:[...new Set(entries.filter(e=>e.side===side).map(e=>e.sourceHash))]}));}
/** Only observed timestamps; acknowledgement/closure has no action timestamp in C15. */
export function observedTimeline(b:Break){return [{label:'检测到差异',at:b.detectedAt},...(b.lastDetectedAt!==b.detectedAt?[{label:'最近检测',at:b.lastDetectedAt}]:[])];}
