import {bffZodSchemas,type BffComponents} from '@sumalpha/api-client';
import type {RouteContext} from '../auth/route-access';
import {compare,type Order} from './policy';
export type OrderTab='all'|'working'|'filled'|'exceptions';
export type OrderView={tab:OrderTab;search:string;symbol:string;recent:boolean};
export const defaultOrderView:OrderView={tab:'all',search:'',symbol:'',recent:false};
export const orderTabs:[OrderTab,string][]=[['all','全部'],['working','进行中'],['filled','已成交'],['exceptions','异常']];
export function inOrderTab(o:Order,tab:OrderTab){return tab==='all'||tab==='working'&&['submitted','accepted','partially_filled','command_ready','awaiting_approval','risk_checking','draft'].includes(o.status)||tab==='filled'&&o.status==='filled'||tab==='exceptions'&&['rejected','expired'].includes(o.status);}
export function visibleOrders(rows:Order[],view:OrderView,now:number){const q=view.search.trim().toLowerCase().slice(0,200);return rows.filter(o=>inOrderTab(o,view.tab)&&(!q||[o.orderId,o.commandId,o.symbol,o.correlationId].some(s=>s.toLowerCase().includes(q)))&&(!view.symbol||view.symbol===o.symbol)&&(!view.recent||now-Date.parse(o.submittedAt)<=86400000)).toSorted((a,b)=>Date.parse(b.submittedAt)-Date.parse(a.submittedAt)||a.orderId.localeCompare(b.orderId));}
export const statusTone=(s:Order['status'])=>s==='filled'?'good':['rejected','expired'].includes(s)?'danger':['partially_filled','awaiting_approval','risk_checking'].includes(s)?'warning':s==='cancelled'?'muted':'info';
function scaled(value:string,scale:number){const[a,b='']=value.split('.');return BigInt(a+b)*10n**BigInt(scale-b.length);}
export function remaining(o:Order){const scale=Math.max(o.quantity.split('.')[1]?.length??0,o.filledQuantity.split('.')[1]?.length??0);const n=scaled(o.quantity,scale)-scaled(o.filledQuantity,scale);if(n<0n)throw Error('Negative remaining quantity');const text=n.toString().padStart(scale+1,'0');return scale?text.slice(0,-scale)+'.'+text.slice(-scale):text;}
/** Only this bounded display ratio becomes a Number; financial strings stay exact. */
export function fillProgress(o:Order){if(compare(o.quantity,'0')<=0||compare(o.filledQuantity,o.quantity)>0)throw Error('Invalid fill ratio');const scale=Math.max(o.quantity.split('.')[1]?.length??0,o.filledQuantity.split('.')[1]?.length??0),bps=scaled(o.filledQuantity,scale)*10000n/scaled(o.quantity,scale);return {basisPoints:Number(bps),label:(bps/100n).toString()+'.'+(bps%100n).toString().padStart(2,'0')+'%'};}
export const compact=(value:string)=>value.length>15?value.slice(0,12)+'…':value;
export const uuid=(value:string|undefined)=>{const parsed=bffZodSchemas.UUID.safeParse(value);return parsed.success?parsed.data:undefined;};
export type Run=BffComponents['schemas']['ReconciliationRun'];
export function reconciliationPage(raw:unknown,c:RouteContext,o:Pick<Order,'orderId'>,now:number){const p=bffZodSchemas.ReconciliationRunPage.strict().parse(raw);if(p.items.length>100||p.nextCursor&&(!p.nextCursor.trim()||p.nextCursor.length>2048))throw Error('Invalid reconciliation page');for(const r of p.items)if(r.accountId!==c.accountId||r.mode!==c.mode||Date.parse(r.asOf)>now||r.evidenceRefs.length>2000)throw Error('Foreign reconciliation source');return {...p,matching:p.items.filter(r=>r.evidenceRefs.some(e=>e.kind==='order'&&e.ref===o.orderId))};}
