import {createBffFetch,bffZodSchemas,parseSse,type SseEventEnvelope} from '@sumalpha/api-client';
import {quote,type Instrument,type Quote} from './policy';
import {MarketError} from './runtime';
export class VenueQuoteFacts {
 private sequence=0;private streamId?:string;private value:Quote|undefined;private revoked=false;
 constructor(readonly instrument:Instrument,initial:Quote){this.instrument=Object.freeze(structuredClone(instrument));this.value=structuredClone(initial);}
 get snapshot(){return this.value&&structuredClone(this.value);}
 get cursor(){return {afterSequence:this.sequence,...this.streamId?{streamId:this.streamId}:{}};}
 revoke(){this.revoked=true;this.value=undefined;this.sequence=0;this.streamId=undefined;}
 apply(raw:SseEventEnvelope,now=Date.now()){
  if(this.revoked)throw new MarketError(403);const e=bffZodSchemas.StreamEvent.parse(raw);if(e.payload.type==='permission_revoked'){this.revoke();throw new MarketError(403);}if(e.payload.type==='market_reset')throw new MarketError(409);
  const q=quote({items:[e.payload]},this.instrument,now),old=this.value;if(q.sequence!==e.sequence||this.streamId&&this.streamId!==e.streamId||old&&[q.provenance.source,q.provenance.approvalRef,q.provenance.approvalVersion,q.provenance.dataSnapshotId].join('|')!==[old.provenance.source,old.provenance.approvalRef,old.provenance.approvalVersion,old.provenance.dataSnapshotId].join('|'))throw new MarketError(502);
  if(old&&e.sequence<old.sequence)return false;if(old&&q.sequence===old.sequence&&(JSON.stringify([q.bid,q.ask,q.mid,q.lastPrice,q.priceKind,q.provenance.asOf])!==JSON.stringify([old.bid,old.ask,old.mid,old.lastPrice,old.priceKind,old.provenance.asOf])||old.provenance.quality==='degraded'&&q.provenance.quality==='passed'))throw new MarketError(502);if(e.sequence<=this.sequence)return false;this.sequence=e.sequence;this.streamId=e.streamId;this.value=structuredClone(q);return true;
 }
 url(origin:string){const u=new URL('/v1/markets/quotes/stream',origin);for(const[k,v]of Object.entries({symbol:this.instrument.canonicalSymbol,venue:this.instrument.venue,product:this.instrument.productType,...this.cursor}))u.searchParams.set(k,String(v));return u.toString();}
}
export function createQuoteFeed(config:{origin:string;instrument:Instrument;initial:Quote;authorize:()=>void;invalidate:(status:number)=>void;fetchImpl?:typeof fetch;now?:()=>number;idleMs?:number}){
 const life=new AbortController(),facts=new VenueQuoteFacts(config.instrument,config.initial),listeners=new Set<()=>void>(),fetcher=createBffFetch(config.fetchImpl??fetch,{signal:life.signal,timeoutMs:10000});
 let status:'idle'|'connecting'|'live'|'disconnected'|'blocked'='idle',busy=false,error:number|undefined;
 const emit=()=>listeners.forEach(f=>f());
 const guard=()=>{config.authorize();if(life.signal.aborted)throw new MarketError(403);};
 return {instrumentId:config.instrument.instrumentId,get view(){return {quote:facts.snapshot,status,busy,error,cursor:facts.cursor};},subscribe(f:()=>void){listeners.add(f);return()=>{listeners.delete(f);};},
 async connect(){guard();if(busy)throw new MarketError(409);busy=true;status='connecting';error=undefined;emit();const idle=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>idle.abort(),config.idleMs??30000);};arm();
 try{const r=await fetcher(facts.url(config.origin),{credentials:'include',cache:'no-store',signal:AbortSignal.any([life.signal,idle.signal]),headers:{accept:'text/event-stream'}});guard();if(r.status!==200||!r.body||!r.headers.get('content-type')?.includes('text/event-stream')){await r.body?.cancel();throw new MarketError(r.status===200?502:r.status);}let frame='';const decoder=new TextDecoder('utf-8',{fatal:true});
 const bounded=r.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,out){frame+=decoder.decode(chunk,{stream:true});let at;while((at=frame.search(/\r?\n\r?\n/))>=0){if(at>65536)throw new MarketError(502);frame=frame.slice(at+(frame[at]==='\r'?4:2));}if(frame.length>65536)throw new MarketError(502);out.enqueue(chunk);}}));
 for await(const e of parseSse(bounded)){guard();facts.apply(e,(config.now??Date.now)());arm();status='live';emit();}if(!life.signal.aborted){status='disconnected';emit();}
 }catch(e){if(!life.signal.aborted){error=(e as {status?:number}).status??502;status=[401,403].includes(error)?'blocked':'disconnected';if(status==='blocked'){facts.revoke();config.invalidate(error);}emit();}}finally{clearTimeout(timer);busy=false;emit();}},
 close(){life.abort();facts.revoke();listeners.clear();}
 };
}
export type QuoteFeed=ReturnType<typeof createQuoteFeed>;
