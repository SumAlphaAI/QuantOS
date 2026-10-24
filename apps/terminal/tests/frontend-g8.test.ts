import {it,expect} from 'vitest';
import {assistedLiveGate} from '@sumalpha/domain-ui';
type DeploymentTargetOption=Parameters<typeof assistedLiveGate>[1][number];
import {refusal} from '../src/approvals/policy';
import {createApprovalRuntime} from '../src/approvals/runtime';
import {createOrdersRuntime} from '../src/orders/runtime';
import {opsContext,opsNow} from './fixtures/scenarios/operations';
const paper:DeploymentTargetOption={target:'paper',enabled:true,reason:'Explicit model Paper'},assisted:DeploymentTargetOption={target:'assisted_live',enabled:true,reason:'Explicit owned model only'};
it.each([
 {flag:false,options:[paper,assisted],reachable:false},
 {flag:true,options:[paper],reachable:false},
 {flag:true,options:[],reachable:false},
 {flag:true,options:[paper,{...assisted,enabled:false}],reachable:false},
 {flag:true,options:[paper,assisted],reachable:true},
 {flag:undefined,options:[assisted],reachable:false},
 {flag:'on',options:[assisted],reachable:false},
])('G8 conditional model requires both explicit server flag and enabled assisted target %#',({flag,options,reachable})=>{const gate=assistedLiveGate(flag as boolean,options);expect(gate.reachable).toBe(reachable);expect(gate.visibleTargets.includes('assisted_live')).toBe(reachable);expect(gate.banner).toContain(reachable?'双人审批':'尚未开放');});
it.each(['research','assisted_live'] as const)('G8 existing P10/P11 runtimes refuse %s without business writes even if model gate is enabled',async(mode)=>{expect(assistedLiveGate(true,[assisted]).reachable).toBe(true);const requests:Request[]=[],config={origin:'https://fixture.invalid',authorize:()=>{},online:()=>true,csrf:()=> 'explicit-model-csrf',now:()=>opsNow,invalidate:()=>{},fetchImpl:async(i:RequestInfo|URL,n?:RequestInit)=>{const r=new Request(i,n);requests.push(r);if(new URL(r.url).origin!=='https://fixture.invalid')throw Error('No network');return Response.json({...opsContext,mode,capabilities:['execution.operate','strategy.approve']});}};const approval=createApprovalRuntime(config),orders=createOrdersRuntime(config);try{await expect(approval.load()).rejects.toMatchObject({status:403});await expect(orders.load()).rejects.toMatchObject({status:403});expect(requests.every(r=>r.method==='GET')).toBe(true);expect(approval.view.receipt).toBeUndefined();expect(orders.view.order).toBeUndefined();}finally{approval.close();orders.close();}});

it('G8 Shadow read context cannot authorize approval even when local gate model is enabled',()=>{const c={...opsContext,mode:'shadow' as const,capabilities:['execution.operate','strategy.approve']};expect(refusal({approvalId:c.actorId,originator:'22222222-2222-4222-8222-222222222222',objectVersion:'0',status:'pending',expiresAt:c.expiresAt,correlationId:c.actorId},c,opsNow)).toBe('FORBIDDEN');});
