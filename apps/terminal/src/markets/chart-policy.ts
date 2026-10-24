import {bffZodSchemas,type BffComponents,type SseEventEnvelope} from '@sumalpha/api-client';
import type {RouteContext} from '../auth/route-access';
import {order,compare,type Order} from '../orders/policy';
import {symbolPattern} from './p18-presentation';
export type Series=BffComponents['schemas']['CandleSeries'];
export type Selection={symbol:string;venue:Series['venue'];product:'spot';interval:Series['interval'];timezone:Series['timezone'];start?:string;end?:string};
export const intervals={'1m':60,'5m':300,'15m':900,'1h':3600,'4h':14400,'1D':86400,'1W':604800} as const;
export function selection(s:Selection):Selection{
 if(!symbolPattern.test(s.symbol)||!['binance','coinbase'].includes(s.venue)||s.product!=='spot'||!Object.hasOwn(intervals,s.interval)||!['UTC','Asia/Shanghai'].includes(s.timezone)||Boolean(s.start)!==Boolean(s.end))throw Error('Invalid chart selection');
 if(s.start&&s.end){bffZodSchemas.DateTime.parse(s.start);bffZodSchemas.DateTime.parse(s.end);}
 if(s.start&&s.end&&(!Number.isFinite(Date.parse(s.start))||!Number.isFinite(Date.parse(s.end))||Date.parse(s.start)>=Date.parse(s.end)||Date.parse(s.end)-Date.parse(s.start)>31*86400000))throw Error('Invalid chart range');
 return structuredClone(s);
}
export function chartLocation(path:string,search:string):Selection{
 const m=/^\/markets\/([^/]+)\/chart$/.exec(path),q=new URLSearchParams(search);
 if(!m||encodeURIComponent(decodeURIComponent(m[1]))!==m[1]||[...q.keys()].some(k=>!['venue','product','interval','timezone','start','end'].includes(k)||q.getAll(k).length!==1))throw Error('Invalid chart route');
 return selection({symbol:decodeURIComponent(m[1]),venue:q.get('venue') as Selection['venue'],product:q.get('product') as 'spot',interval:(q.get('interval')??'1m') as Selection['interval'],timezone:(q.get('timezone')??'UTC') as Selection['timezone'],...(q.has('start')?{start:q.get('start')!}:{}),...(q.has('end')?{end:q.get('end')!}:{})});
}
export function chartHref(s:Selection){selection(s);const {symbol,...query}=s;return `/markets/${encodeURIComponent(symbol)}/chart?${new URLSearchParams(Object.entries(query).filter(([,value])=>value!==undefined) as [string,string][])}`;}
export function candleSeries(raw:unknown,s:Selection,now:number):Series{
 const v=bffZodSchemas.CandleSeries.parse(raw),p=v.provenance,step=intervals[s.interval]*1000;
 if(v.instrumentId!==`${s.venue}:${s.product}:${s.symbol}`||v.canonicalSymbol!==s.symbol||v.venue!==s.venue||v.productType!==s.product||v.interval!==s.interval||v.timezone!==s.timezone||p.venue!==s.venue||![p.source,p.license,p.approvalRef,p.approvalVersion].every(x=>x.trim()&&x.length<=500)||!Number.isSafeInteger(v.sequence)||!Number.isSafeInteger(p.latencyMs)||!Number.isFinite(now)||Date.parse(p.asOf)>now||v.gaps.length>501||v.eventMarkers.length>501)throw Error('Series binding mismatch');
 let previous=-Infinity;
 for(const b of v.ohlcv){const t=Date.parse(b.t);const offset=s.timezone==='Asia/Shanghai'?28800000:0,anchor=s.interval==='1W'?345600000:0;
  if(t<=previous||t>Date.parse(p.asOf)||(t+offset-anchor)%step!==0||s.start&&t<Math.floor((Date.parse(s.start)+offset-anchor)/step)*step+anchor-offset||s.end&&t>=Date.parse(s.end))throw Error('Invalid candle time');
  for(const x of [b.o,b.h,b.l,b.c,b.v])if(x.length>100||!Number.isFinite(Number(x))||Number(x)>1e100)throw Error('Unrenderable candle');
  if([b.o,b.h,b.l,b.c].some(x=>compare(x,'0')<=0)||compare(b.h,b.l)<0||compare(b.h,b.o)<0||compare(b.h,b.c)<0||compare(b.l,b.o)>0||compare(b.l,b.c)>0)throw Error('Invalid OHLC');previous=t;
 }
 let end=-Infinity;for(const g of v.gaps){const a=Date.parse(g.start),b=Date.parse(g.end);if(a>=b||a<end||v.ohlcv.some(c=>Date.parse(c.t)>=a&&Date.parse(c.t)<b))throw Error('Invalid gap');end=b;}
 for(let n=1;n<v.ohlcv.length;n++){const a=Date.parse(v.ohlcv[n-1].t)+step,b=Date.parse(v.ohlcv[n].t);if(b>a&&!v.gaps.some(g=>Date.parse(g.start)<=a&&Date.parse(g.end)>=b))throw Error('Unreported gap');}
 if(v.eventMarkers.length!==v.gaps.length||v.eventMarkers.some((e,n)=>Date.parse(e.at)!==Date.parse(v.gaps[n].start)))throw Error('Gap marker mismatch');
 return v;
}
/** C12 frames replace the full series; global trade sequences may jump. */
export class CandleFacts{
 private value?:Series;private stream?:string;private after=0;private closed=false;
 constructor(readonly selected:Selection,initial:Series){this.selected=Object.freeze(selection(selected));this.value=structuredClone(initial);}
 get snapshot(){return this.value&&structuredClone(this.value);}get cursor(){return{afterSequence:this.after,...this.stream?{streamId:this.stream}:{}};}
 revoke(){this.closed=true;this.value=undefined;this.stream=undefined;this.after=0;}
 apply(raw:SseEventEnvelope,now:number){if(this.closed)throw Error('Chart revoked');const e=bffZodSchemas.StreamEvent.parse(raw);if(e.payload.type==='permission_revoked'){this.revoke();throw Object.assign(Error('Chart revoked'),{status:403});}if(e.payload.type==='market_reset')throw Object.assign(Error('Chart reset required'),{status:409});
  const v=candleSeries(e.payload,this.selected,now),old=this.value!;
  if(e.sequence!==v.sequence||this.stream&&e.streamId!==this.stream||Date.parse(e.occurredAt)>now||[v.provenance.source,v.provenance.approvalRef,v.provenance.approvalVersion,v.provenance.dataSnapshotId].join('|')!==[old.provenance.source,old.provenance.approvalRef,old.provenance.approvalVersion,old.provenance.dataSnapshotId].join('|'))throw Error('Series stream binding mismatch');
  if(e.sequence<old.sequence)return false;
  if(Date.parse(v.provenance.asOf)<Date.parse(old.provenance.asOf)||e.sequence===old.sequence&&JSON.stringify({...v,provenance:{...v.provenance,latencyMs:0}})!==JSON.stringify({...old,provenance:{...old.provenance,latencyMs:0}}))throw Error('Conflicting series replay');
  if(e.sequence<=this.after)return false;this.stream=e.streamId;this.after=e.sequence;this.value=v;return true;
 }
}
/** Visual indicators use floating point only; exact raw OHLCV remain in the table. Reset across gaps. */
export function indicators(v:Series,kind:'SMA'|'EMA',period:number){if(!Number.isInteger(period)||period<2||period>200)throw Error('Invalid indicator period');let window:number[]=[],ema:number|undefined;return v.ohlcv.map((b,n)=>{if(n&&Date.parse(b.t)-Date.parse(v.ohlcv[n-1].t)!==intervals[v.interval]*1000){window=[];ema=undefined;}window.push(Number(b.c));if(window.length>period)window.shift();if(window.length<period)return null;const sma=window.reduce((a,b)=>a+b,0)/period;ema=ema===undefined?sma:Number(b.c)*2/(period+1)+ema*(1-2/(period+1));return kind==='SMA'?sma:ema;});}
export type ChartMarker={id:string;orderId:string;kind:'order'|'fill';at:string;side:Order['side'];price?:string;quantity:string;status:string;correlationId:string};
export function chartMarkers(raw:unknown[],c:RouteContext,s:Selection,now:number){
 const seen=new Set<string>(),markers:ChartMarker[]=[];let excluded=0;
 for(const item of raw){const o=order(item,c,undefined,now);if(seen.has(o.orderId))throw Error('Duplicate order');seen.add(o.orderId);
  // C09 has no product dimension. Accept only an explicit spot product field;
  // missing product and mock/Paper venue cannot be inferred into a C12 series.
  if(o.venue!==s.venue||o.venueKind!==s.venue||o.symbol!==s.symbol&&o.symbol!==s.symbol.replace('/','')||o.productType!==s.product){excluded++;continue;}
  const inRange=(at:string)=>(!s.start||Date.parse(at)>=Date.parse(s.start))&&(!s.end||Date.parse(at)<Date.parse(s.end));
  if(inRange(o.submittedAt))markers.push({id:o.orderId,orderId:o.orderId,kind:'order',at:o.submittedAt,side:o.side,quantity:o.quantity,status:o.status,correlationId:o.correlationId});
  for(const f of o.fills)if(inRange(f.at))markers.push({id:f.fillId,orderId:o.orderId,kind:'fill',at:f.at,side:o.side,price:f.price,quantity:f.quantity,status:o.status,correlationId:o.correlationId});
 }
 return {markers:markers.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)),excluded};
}
