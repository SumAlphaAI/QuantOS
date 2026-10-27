import {it,expect} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {bffZodSchemas} from '@sumalpha/api-client';
import {reference} from './helpers/fep5-reference';
import {createApprovalRuntime} from '../src/approvals/runtime';
import {createOrdersRuntime} from '../src/orders/runtime';
it('G8 current real C09 provider binds the disabled declaration to each C01 reader and actual P10/P11 consume it',async()=>{
 const s=await reference(),approvals=createApprovalRuntime({...s.config(s.transport('session-approver')),highFidelity:true}),orders=createOrdersRuntime(s.config());
 try{const contexts=[];for(const who of ['session-current','session-approver'] as const){const c=s.client(who),context=(await c.GET('/v1/context')).data!,r=await c.GET('/v1/order-capabilities',{params:{query:{accountId:context.accountId,includeAssistedTestnetAdmission:'true'}}});expect(r.response.status).toBe(200);const caps=bffZodSchemas.OrderCapabilities.strict().parse(r.data),d=caps.assistedTestnetAdmission!;expect(d.schemaVersion).toBe('quantos-assisted-testnet-admission.v1');for(const key of ['actorId','tenantId','workspaceId','accountId','mode'] as const)expect(d[key]).toBe(context[key]);expect(d.serverFlagEnabled).toBe(false);expect(d.targetEnabled).toBe(false);expect(d.executionAuthority).toBe(false);expect(Date.parse(d.expiresAt)-Date.parse(d.checkedAt)).toBe(8000);contexts.push({actorId:context.actorId,tenantId:context.tenantId,workspaceId:context.workspaceId,accountId:context.accountId,mode:context.mode,admission:d});}
 await approvals.load();await approvals.list();expect(approvals.view.assistedAdmission).toMatchObject({state:'closed',reachable:false});await orders.load();await orders.list();expect(orders.view.assistedAdmission).toMatchObject({state:'closed',reachable:false});expect(s.rows.every(r=>r.method==='GET')).toBe(true);
 const path=process.env.QUANTOS_G8_CURRENT_HTTP;if(path){mkdirSync(path,{recursive:true});writeFileSync(path+'/admission-read.json',JSON.stringify({schema:'quantos-g8-current-http/v1',sourceCommit:process.env.GITHUB_SHA,scope:'ACTUAL_REFERENCE_C01_C09_P10_P11_READ_ONLY_NOT_ASSISTED_EXECUTION',contexts,p10:approvals.view.assistedAdmission,p11:orders.view.assistedAdmission,businessWrites:0,actualTestnetConnected:false,productionCredentialsUsed:false,rows:s.rows},null,2)+'\n');}
 }finally{approvals.close();orders.close();await s.close();}
},20000);
