import {indicators,intervals,type Series,type Selection,type ChartMarker} from './chart-policy';
export type ChartView={quality:'all'|'passed'|'degraded';primary:'SMA'|'EMA';period:number;movingAverage:boolean;vwap:boolean;rsi:boolean;orders:boolean;fills:boolean;gaps:boolean;follow:boolean};
export const defaultChartView:ChartView={quality:'all',primary:'SMA',period:20,movingAverage:true,vwap:true,rsi:true,orders:true,fills:true,gaps:true,follow:true};
export const chartViewKey='quantos.p19.view.v1';
/** Persist layout only. Market data, dimensions, account and authority never enter storage. */
export function parseChartView(raw:string|null):ChartView{
 try{const v=JSON.parse(raw??'null');if(!v||typeof v!=='object')return{...defaultChartView};return {...defaultChartView,quality:['all','passed','degraded'].includes(v.quality)?v.quality:'all',primary:v.primary==='EMA'?'EMA':'SMA',period:Number.isInteger(v.period)&&v.period>=2&&v.period<=200?v.period:20,...Object.fromEntries(['movingAverage','vwap','rsi','orders','fills','gaps','follow'].map(k=>[k,typeof v[k]==='boolean'?v[k]:defaultChartView[k as keyof ChartView]]))};}catch{return{...defaultChartView};}
}
export const saveableChartView=(view:ChartView)=>parseChartView(JSON.stringify(view));
export const qualityMatches=(s:Series,view:ChartView)=>view.quality==='all'||s.provenance.quality===view.quality;
const reset=(s:Series,n:number)=>n===0||Date.parse(s.ohlcv[n].t)-Date.parse(s.ohlcv[n-1].t)!==intervals[s.interval]*1000;
/** Session VWAP approximation: HLC3 * volume. No per-trade price/volume is invented. */
export function sessionVwap(s:Series){let weighted=0,volume=0,day='';const offset=s.timezone==='Asia/Shanghai'?28800000:0;return s.ohlcv.map((b,n)=>{const next=new Date(Date.parse(b.t)+offset).toISOString().slice(0,10);if(reset(s,n)||next!==day){weighted=0;volume=0;}day=next;const v=Number(b.v);weighted+=(Number(b.h)/3+Number(b.l)/3+Number(b.c)/3)*v;volume+=v;return volume>0?weighted/volume:null;});}
/** Wilder RSI; re-seeded after every observed gap. */
export function rsi(s:Series,period=14){if(!Number.isInteger(period)||period<2||period>200)throw Error('Invalid RSI period');let gain=0,loss=0,count=0;return s.ohlcv.map((b,n)=>{if(reset(s,n)){gain=0;loss=0;count=0;return null;}const delta=Number(b.c)-Number(s.ohlcv[n-1].c),g=Math.max(0,delta),l=Math.max(0,-delta);count++;if(count<=period){gain+=g/period;loss+=l/period;}else{gain=(gain*(period-1)+g)/period;loss=(loss*(period-1)+l)/period;}return count<period?null:loss===0?gain===0?50:100:100-100/(1+gain/loss);});}
export function chartOverlays(s:Series,view:ChartView){return {moving:indicators(s,view.primary,view.period),vwap:sessionVwap(s),rsi:rsi(s)};}
export function visibleMarkers(markers:ChartMarker[],view:ChartView){return markers.filter(m=>m.kind==='order'?view.orders:view.fills);}
export function candleReference(s:Series,time:string){if(!s.ohlcv.some(b=>b.t===time))throw Error('Candle no longer present');return JSON.stringify({instrumentId:s.instrumentId,venue:s.venue,product:s.productType,interval:s.interval,timezone:s.timezone,at:time,dataSnapshotId:s.provenance.dataSnapshotId,source:s.provenance.source,asOf:s.provenance.asOf});}
export function moveCandle(s:Series,time:string|undefined,delta:number){const index=s.ohlcv.findIndex(b=>b.t===time);return s.ohlcv[Math.max(0,Math.min(s.ohlcv.length-1,(index<0?s.ohlcv.length-1:index)+delta))]?.t;}
export function selectedCandle(s:Series|undefined,time:string|undefined){return s?.ohlcv.find(b=>b.t===time)??s?.ohlcv.at(-1);}
export const viewSelectionKey=(s:Selection)=>JSON.stringify([s.symbol,s.venue,s.product,s.interval,s.timezone,s.start??'',s.end??'']);
export function displayTime(at:string,timezone:Series['timezone']){return new Intl.DateTimeFormat('en-GB',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(at));}
