import type {Query,View} from './policy';
export type ChartMetric='equity'|'pnl';
export type DisplayView={metric:ChartMetric;showTable:boolean};
export const defaultDisplay:DisplayView={metric:'equity',showTable:false};
// Only presentation preferences cross visits. No query, authority, report or money is stored.
export function displayView(raw:string|null):DisplayView{try{const v=JSON.parse(raw??'{}');return{metric:v?.metric==='pnl'?'pnl':'equity',showTable:v?.showTable===true};}catch{return{...defaultDisplay};}}
export function displayPreference(v:DisplayView){return JSON.stringify(displayView(JSON.stringify(v)));}
function parts(v:string){if(!/^-?\d+(\.\d+)?$/.test(v)||v.length>160)throw Error('Invalid decimal');const [integer,fraction='']=v.replace(/^-/,'').split('.');return{negative:v.startsWith('-'),integer,fraction};}
function scaled(v:string,scale:number){const p=parts(v);return BigInt(p.integer+p.fraction.padEnd(scale,'0'))*(p.negative?-1n:1n);}
export function difference(a:string,b:string){const scale=Math.max(parts(a).fraction.length,parts(b).fraction.length),n=scaled(a,scale)-scaled(b,scale),digits=(n<0n?-n:n).toString().padStart(scale+1,'0');return(n<0n?'-':'')+(scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits);}
export function exactNumber(v:string){const p=parts(v);return(p.negative?'-':'')+p.integer.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(p.fraction?'.'+p.fraction:'');}
export function percent(v:string){const p=parts(v),digits=(p.integer+p.fraction).padEnd(p.integer.length+2,'0'),cut=p.integer.length+2;return(p.negative?'-':'')+BigInt(digits.slice(0,cut)).toString()+(digits.slice(cut)?'.'+digits.slice(cut):'')+'%';}
// Convert only bounded relative coordinates to Number. Monetary labels retain their exact strings.
export function relative(values:string[]){if(!values.length)return[];const scale=Math.max(...values.map(v=>parts(v).fraction.length)),units=values.map(v=>scaled(v,scale)),min=units.reduce((a,b)=>a<b?a:b),max=units.reduce((a,b)=>a>b?a:b),span=max-min;return units.map(v=>span===0n?.5:Number((v-min)*1000000n/span)/1000000);}
export const plottedValues=(v:View,metric:ChartMetric)=>v.series.map(p=>metric==='equity'?p.equity:difference(p.equity,v.series[0].equity));
export function adjacentChanges(v:View){return v.series.slice(1).map((p,i)=>({asOf:p.asOf,change:difference(p.equity,v.series[i].equity),gap:Date.parse(p.asOf)-Date.parse(v.series[i].asOf)>v.coverage.maxIntervalSeconds*1000}));}
export function draftChanged(draft:Query,applied?:Query){return !applied||(['accountId','currency','method','period','periodMode','start'] as const).some(k=>draft[k]!==applied[k])||draft.period==='custom'&&draft.end!==applied.end;}
export function nearestPoint(v:View,at:number){let best=0;v.series.forEach((p,i)=>{if(Math.abs(Date.parse(p.asOf)-at)<Math.abs(Date.parse(v.series[best].asOf)-at))best=i;});return best;}
