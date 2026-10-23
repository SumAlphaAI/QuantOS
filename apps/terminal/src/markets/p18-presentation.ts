import type {Instrument,MarketRow} from './policy';
export type MarketLocation={kind:'overview'}|{kind:'detail';symbol:string;venue?:'binance'|'coinbase';product?:'spot'};
export const symbolPattern=/^[A-Z0-9]{1,20}\/[A-Z0-9]{1,20}$/;
export function marketLocation(path:string,search=''):MarketLocation{
 if(path==='/markets'||path==='/markets/') {if(search)throw Error('Unexpected market query');return {kind:'overview'};}
 const parts=path.split('/');if(parts.length!==3||parts[1]!=='markets')throw Error('Invalid market route');
 const symbol=decodeURIComponent(parts[2]);if(!symbolPattern.test(symbol)||encodeURIComponent(symbol)!==parts[2])throw Error('Invalid market symbol');
 const query=new URLSearchParams(search);for(const k of query.keys())if(!['venue','product'].includes(k)||query.getAll(k).length!==1)throw Error('Invalid market dimension');
 const venue=query.get('venue'),product=query.get('product');if(venue&&!['binance','coinbase'].includes(venue)||product&&product!=='spot'||Boolean(venue)!==Boolean(product))throw Error('Invalid market dimension');
 return {kind:'detail',symbol,...venue?{venue:venue as 'binance'|'coinbase',product:'spot' as const}:{}};
}
export const marketHref=(i:Instrument)=>`/markets/${encodeURIComponent(i.canonicalSymbol)}?venue=${i.venue}&product=${i.productType}`;
export const defaultMarketView={search:'',venue:'all',currency:'all',quality:'all',tab:'all',density:'comfortable',provenance:true} as const;
export type MarketView={search:string;venue:'all'|'binance'|'coinbase';currency:string;quality:'all'|'passed'|'degraded'|'unavailable';tab:'all'|'watchlist'|'recent';density:'comfortable'|'compact';provenance:boolean};
export const marketViewKey='quantos.p18.view.v1';
export function parseMarketView(raw:string|null):MarketView{
 try{const v=JSON.parse(raw??'null');if(!v||typeof v!=='object')return {...defaultMarketView};return {search:typeof v.search==='string'&&v.search.length<=60?v.search:'',venue:['all','binance','coinbase'].includes(v.venue)?v.venue:'all',currency:typeof v.currency==='string'&&/^(all|[A-Z0-9]{1,20})$/.test(v.currency)?v.currency:'all',quality:['all','passed','degraded','unavailable'].includes(v.quality)?v.quality:'all',tab:['all','watchlist','recent'].includes(v.tab)?v.tab:'all',density:v.density==='compact'?'compact':'comfortable',provenance:typeof v.provenance==='boolean'?v.provenance:true};}catch{return {...defaultMarketView};}
}
export function filterMarkets(items:Instrument[],rows:MarketRow[],view:MarketView,watch:string[],recent:string[]){return items.filter(i=>(view.venue==='all'||i.venue===view.venue)&&(view.currency==='all'||i.canonicalSymbol.split('/')[1]===view.currency)&&i.canonicalSymbol.toLowerCase().includes(view.search.toLowerCase())&&(view.tab==='all'||(view.tab==='watchlist'?watch:recent).includes(i.instrumentId))&&(view.quality==='all'||(rows.find(r=>r.instrument.instrumentId===i.instrumentId)?.quote.provenance.quality??'unavailable')===view.quality));}
/** Exact display arithmetic only; never chooses a venue or routes an order. */
export function decimalSpread(bid:string|null,ask:string|null):string|undefined{
 if(!bid||!ask||![bid,ask].every(v=>/^\d+(\.\d+)?$/.test(v)))return;
 const scale=Math.max(bid.split('.')[1]?.length??0,ask.split('.')[1]?.length??0);if(scale>100||bid.length>200||ask.length>200)return;
 const units=(v:string)=>{const [whole,fraction='']=v.split('.');return BigInt(whole+fraction.padEnd(scale,'0'));};
 const difference=units(ask)-units(bid);if(difference<0n)return;const digits=difference.toString().padStart(scale+1,'0');return scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits;
}
