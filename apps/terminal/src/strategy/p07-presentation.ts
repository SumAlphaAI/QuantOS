import {z} from "zod";
// Presentation accepts only actual bounded fill records, never generated equity or dates.
const fill=z.object({execution_bar:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),signal_bar:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),side:z.enum(["long","short","flat"]),quantity:z.number().finite().nonnegative(),reference_price:z.number().finite().nonnegative(),fill_price:z.number().finite().nonnegative(),fee:z.number().finite().nonnegative(),slippage:z.number().finite().nonnegative()}).refine(f=>f.signal_bar<f.execution_bar);
export type ReportFill=z.infer<typeof fill>;
export function reportFills(raw:unknown):ReportFill[]|undefined {
 const parsed=z.array(fill).max(2000).safeParse(raw);
 if(!parsed.success||parsed.data.some((f,i,a)=>i>0&&f.execution_bar<a[i-1].execution_bar))return undefined;
 try{cumulativeCosts(parsed.data);}catch{return undefined;}
 return parsed.data;
}
export function cumulativeCosts(fills:ReportFill[]){let fees=0,slippage=0;return fills.map(f=>{fees+=f.fee;slippage+=f.slippage;if(!Number.isFinite(fees+slippage))throw Error("Cost series overflow");return {bar:f.execution_bar,fees,slippage,total:fees+slippage};});}
export function exactMetric(raw:unknown){return typeof raw==="string"&&/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)?raw:"未提供";}
export function compactRef(value:string){return value.length>24?value.slice(0,12)+"…"+value.slice(-8):value;}
export function utcLabel(raw:string){const date=new Date(raw);return Number.isFinite(date.getTime())?date.toISOString().replace("T"," ").replace(/\.\d{3}Z$/," UTC"):"时间无效";}

// Approximation is confined to dimensionless ratios; exact strings remain in the cost tab/raw report.
export function ratioLabel(raw:unknown,percent=false){const exact=exactMetric(raw),n=Number(exact);if(exact==='未提供'||!Number.isFinite(n)||Math.abs(n)>1e6)return exact;return (n*(percent?100:1)).toFixed(percent?4:3)+(percent?'%':'');}
