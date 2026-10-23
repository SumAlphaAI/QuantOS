import {bffZodSchemas} from '@sumalpha/api-client';
import type {TicketSnapshot} from './policy';
export type TicketLocation={symbol?:string;proposalId?:string};
export const symbolPattern=/^[A-Z0-9]{2,40}$/;
export function ticketLocation(path:string,search=''):TicketLocation {
 const match=/^\/trade(?:\/([^/]+))?$/.exec(path);if(!match)throw Error('Invalid ticket route');
 const symbol=match[1];if(symbol&&!symbolPattern.test(symbol))throw Error('Invalid ticket symbol');
 const q=new URLSearchParams(search);if([...q.keys()].some(k=>k!=='proposalId')||q.getAll('proposalId').length>1)throw Error('Invalid ticket query');
 return {symbol,proposalId:q.has('proposalId')?bffZodSchemas.UUID.parse(q.get('proposalId')).toLowerCase():undefined};
}
export function ticketHref(symbol:string,id?:string){if(!symbolPattern.test(symbol))throw Error('Invalid ticket symbol');return '/trade/'+symbol+(id?'?proposalId='+bffZodSchemas.UUID.parse(id).toLowerCase():'');}
export function executionChecks(s:TicketSnapshot|undefined,current:boolean){return [
 {name:'行情时效',value:!s?'尚未读取':current?'Fresh · 参考行情':'陈旧 / 待重新核查',tone:current?'good':'warning'},
 {name:'Venue 健康',value:s?(s.ticket.venueHealthy?'Healthy':'Unhealthy'):'未知',tone:s?.ticket.venueHealthy?'good':'warning'},
 {name:'账户可用余额',value:'来源未提供 · 浏览器未核验',tone:'warning'},
 {name:'仓位影响',value:'未提供仓位影响投影',tone:'muted'},
 {name:'风险预检',value:s?s.preflight.verdict:'尚未评估',tone:s?.preflight.verdict==='deny'?'danger':'warning'},
 {name:'Kill switch',value:s?'由当前服务端预检核验；无独立状态字段':'待服务端核验',tone:'muted'},
 {name:'权限与模式',value:s?s.preflight.mode.toUpperCase()+' · 服务端重验':'读取当前权限',tone:'muted'}
 ];}
export const quoteValue=(value:string|null|undefined)=>value??'未提供';
