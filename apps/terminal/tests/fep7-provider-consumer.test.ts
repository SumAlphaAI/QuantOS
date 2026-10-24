// Fresh GET-only actual reference consumers. Reuse unchanged G7 binary; never rebind its build SHA.
import {it,expect} from 'vitest';
import {createBffClient} from '@sumalpha/api-client';
import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {referenceBffExecutable} from './helpers/reference-bff';
import {reference} from './helpers/fep5-reference';
import {commandView} from '../src/command/gateway';
import {createPortfolioRuntime} from '../src/portfolio/runtime';
import {createPerformanceRuntime} from '../src/performance/runtime';
import {createMarketRuntime} from '../src/markets/runtime';
import {createAlertsRuntime} from '../src/alerts/runtime';
import {createOperationsRuntime} from '../src/operations/runtime';
import {createAdminRuntime} from '../src/admin/runtime';
import {loadSettingsSnapshot} from '../src/settings/gateway';
import {listDataSnapshots,listResearchRuns} from '../src/research/gateway';
for(const mode of ['paper','shadow'] as const)it(`FEP7 ${mode} actual GET-only scope census preserves source and authority gaps`,async()=>{
 const s=await reference(mode),wire=(session='session-current'):typeof fetch=>async(i,n)=>{const req=new Request(i,n);if(req.method!=='GET')throw Error('FEP7 scope consumer forbids mutations');return s.transport(session)(req);},config=(session='session-current')=>({...s.config(wire(session)),desktop:()=>true});
 const portfolio=createPortfolioRuntime(config()),performance=createPerformanceRuntime(config()),markets=createMarketRuntime({...config(),partialQuotes:true}),alerts=createAlertsRuntime(config()),operations=createOperationsRuntime(config()),admin=createAdminRuntime(config('session-owner'));
 try{
 // Generated GETs here also use the strictly read-only transport, unlike the helper's default client.
 const client=createBffClient({baseUrl:s.origin,fetch:wire()});
 const ctx=(await client.GET('/v1/context')).data!;expect(ctx.mode).toBe(mode);
 const command=commandView((await client.GET('/v1/command/summary',{params:{query:{accountId:ctx.accountId}}})).data,ctx.accountId!,mode);
 expect((await listDataSnapshots(s.origin,{},wire())).items.length).toBeGreaterThan(0);const research=await listResearchRuns(s.origin,{},wire());expect(research.items).toEqual([]);
 const strategies=await client.GET('/v1/strategies');expect(strategies.response.status).toBe(mode==='paper'?200:403);
 await portfolio.load();if(mode==='paper'){await portfolio.refresh();expect(portfolio.view.snapshot?.portfolio.accountId).toBe(ctx.accountId);}else{await expect(portfolio.refresh()).rejects.toMatchObject({status:403});expect(portfolio.view.snapshot).toBeUndefined();}
 await markets.load();await markets.refresh();expect(markets.view.rows.length).toBeGreaterThan(0);
 const settings=await loadSettingsSnapshot(s.origin,wire());expect(settings.context.actorId).toBe(ctx.actorId);expect(settings.context.mode).toBe(mode);expect(settings.bundle.browserPolicy).toBeDefined();
 if(mode==='shadow'){await performance.load();await performance.refresh({accountId:ctx.accountId,currency:'USD',method:'simple',period:'week',periodMode:'rolling'});expect(performance.view.data?.provisional).toBe(true);expect(performance.view.links.length).toBe(performance.view.data?.series.length);}else await expect(performance.load()).rejects.toMatchObject({status:403});
 for(const path of ['/v1/proposals','/v1/approvals','/v1/orders'] as const){const page=await client.GET(path,{params:{query:{accountId:ctx.accountId}}});expect(page.response.status).toBe(mode==='paper'?200:403);}
 await alerts.load();await alerts.refresh();await alerts.open(alerts.view.items[0]!.id);await alerts.connect();expect(alerts.view.stream).toBe('disconnected');expect(alerts.view.detail?.resolved).toBe(false);
 await operations.load();await operations.refresh();await operations.inspectAlert(alerts.view.detail!.id);expect(operations.view.sourceAlert?.sourceRef).toBe(alerts.view.detail?.sourceRef);expect(operations.view.health?.ready).toBe(false);
 await admin.load();await admin.refresh();expect(admin.view.rows.length).toBeGreaterThan(0);expect(admin.view.rows.filter(r=>r.spec.kind==='engine_capability'&&r.spec.enabled)).toEqual([]);
 const owner=createBffClient({baseUrl:s.origin,fetch:wire('session-owner')}),ownerContext=(await owner.GET('/v1/context')).data!;expect(ownerContext.capabilities).not.toContain('audit:read');expect([403,404]).toContain((await owner.GET('/v1/audit/events')).response.status);expect((await client.GET('/v1/audit/events')).response.status).toBe(200);
 expect(s.rows.every(r=>r.method==='GET'&&r.source==='REFERENCE_BYTES')).toBe(true);
 const dir=process.env.QUANTOS_FEP7_READ_DIR;if(dir){mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/${mode}.json`,JSON.stringify({schema:'quantos-fep7-read-census/v1',sourceCommit:process.env.GITHUB_SHA,fixtureSourceCommit:process.env.GITHUB_SHA,binarySourceCommit:'abc4c1707a25a5dc6fd0e04f73ba7e41fd62e691',binarySha256:'sha256:'+createHash('sha256').update(readFileSync(referenceBffExecutable())).digest('hex'),scope:'READ_ONLY_ACTUAL_REFERENCE_BINARY_REUSED',identity:'EXPLICIT_REFERENCE_COOKIE_INJECTION',cors:'NOT_EXERCISED_NODE_HTTP',mode,accountId:ctx.accountId,businessWrites:0,newMutationAuditChain:'NOT_RUN_READ_ONLY',commandPartial:command.partial,portfolioStatus:mode==='paper'?200:403,strategyStatus:strategies.response.status,performanceStatus:mode==='shadow'?200:403,researchHttpWorkerJoin:'NOT_RUN_READ_ONLY',releaseProposalJoin:'NOT_RUN_READ_ONLY',resolved:alerts.view.detail?.resolved,notification:alerts.view.stream,healthReady:operations.view.health?.ready,sourceBinding:{alert:alerts.view.detail?.sourceRef,incidentSource:operations.view.sourceAlert?.sourceRef},enabledEngines:0,ownerAuditRead:false,marketRows:markets.view.rows.length,performanceLinks:performance.view.links.length,rows:s.rows},null,2)+'\n');}
 }finally{portfolio.close();performance.close();markets.close();alerts.close();operations.close();admin.close();await s.close();}
},30000);
