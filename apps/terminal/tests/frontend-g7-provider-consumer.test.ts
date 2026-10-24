import {it,expect} from 'vitest';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reference,header,csrf} from './helpers/fep5-reference';
import {referenceBffExecutable} from './helpers/reference-bff';
import {commandView} from '../src/command/gateway';
import {createPortfolioRuntime} from '../src/portfolio/runtime';
import {loadSettingsSnapshot} from '../src/settings/gateway';
import {listDataSnapshots,createResearchRun,getResearchRun,cancelResearchRun} from '../src/research/gateway';
import {preparedRelease,checkedRelease,assertReleaseBinding,releaseTargets} from '../src/strategy/release-policy';
import {createControlledTicket} from '../src/trade/p20-runtime';
import {createApprovalRuntime} from '../src/approvals/runtime';
import {createPerformanceRuntime} from '../src/performance/runtime';
import {createAlertsRuntime} from '../src/alerts/runtime';
import {createOperationsRuntime} from '../src/operations/runtime';
import {createAdminRuntime} from '../src/admin/runtime';
import {loadEvidenceChain} from '../src/audit/gateway';

for(const mode of ['paper','shadow'] as const)it(`G7 ${mode} same process research strategy approval execution/report operations governance and separate audit roots`,async()=>{
 const s=await reference(mode),c=s.client(),ticket=createControlledTicket(s.config()),approver=createApprovalRuntime({...s.config(s.transport('session-approver')),highFidelity:true}),portfolio=createPortfolioRuntime(s.config()),p=createPerformanceRuntime(s.config()),alerts=createAlertsRuntime(s.config()),ops=createOperationsRuntime({...s.config(),desktop:()=>true}),admin=createAdminRuntime({...s.config(s.transport('session-owner')),desktop:()=>true});
 const roots:{correlationId:string;auditRef:string;events:number}[]=[];
 const audit=async(r:{correlationId?:string;auditRef?:string})=>{expect(r.correlationId).toBeTruthy();expect(r.auditRef).toBeTruthy();const chain=await loadEvidenceChain(s.origin,r.correlationId!,{},s.transport());expect(chain.complete).toBe(true);expect(chain.items.filter(e=>e.eventId===r.auditRef)).toHaveLength(1);roots.push({correlationId:r.correlationId!,auditRef:r.auditRef!,events:chain.items.length});};
 try{
 const ctx=(await c.GET('/v1/context')).data!;expect(ctx.mode).toBe(mode);
 const command=commandView((await c.GET('/v1/command/summary',{params:{query:{accountId:ctx.accountId}}})).data,ctx.accountId!,mode);
 await portfolio.load();if(mode==='paper'){await portfolio.refresh();expect(portfolio.view.snapshot?.portfolio.accountId).toBe(ctx.accountId);expect(portfolio.view.context?.mode).toBe(mode);}else{await expect(portfolio.refresh()).rejects.toMatchObject({status:403});expect(portfolio.view.snapshot).toBeUndefined();}
 const settings=await loadSettingsSnapshot(s.origin,s.transport());expect(settings.context.actorId).toBe(ctx.actorId);expect(settings.context.mode).toBe(mode);expect(settings.bundle.profile).toBeDefined();expect(settings.bundle.browserPolicy).toBeDefined();
 const census={command:{accountId:command.accountId,mode:command.mode,partial:command.partial,sources:command.sources},portfolio:{accountId:ctx.accountId,mode,status:mode==='paper'?200:403,positive:mode==='paper'?'VERIFIED_REFERENCE_SNAPSHOT':'NOT_PROVIDED_REFERENCE_MODE'},settings:{actorId:settings.context.actorId,mode:settings.context.mode,sections:['profile','notifications','security','sessions','devices','downloads','browserPolicy']}};
 await admin.load();await admin.refresh();await admin.act('capabilities','POST',{...admin.view.reviews[0]!,enabled:true},undefined,'G7 reviewed research capability before workflow','123456',true);await audit(admin.view.receipts[0]!);
 const snapshots=await listDataSnapshots(s.origin,{},s.transport()),snapshot=snapshots.items.find(x=>!x.qualityBlocked)!;
 const run=await createResearchRun(s.origin,{capability:'research.hypothesis.v1',dataSnapshotId:snapshot.snapshotId,question:'G7 bounded pipeline source assessment',budget:'10',deadlineAt:new Date(Date.now()+3600000).toISOString(),attachments:[]},crypto.randomUUID(),csrf,s.transport());
 expect((await getResearchRun(s.origin,run.jobId,s.transport())).status).toBe('queued');await audit(run);
 await audit(await cancelResearchRun(s.origin,run.jobId,crypto.randomUUID(),csrf,s.transport()));
 // This draft is an independently seeded source. Never relabel a queued research run as its producer.
 let strategyId:string|undefined,releaseId:string|undefined;
 if(mode==='paper'){
 strategyId=(await c.GET('/v1/strategies')).data!.items[0]!.strategyId;
 const draft=(await c.GET('/v1/strategies/{strategyId}/draft',{params:{path:{strategyId}}})).data!;
 const ack=await c.POST('/v1/backtests',{params:{header:header()},body:{strategyId,objectVersion:draft.objectVersion,dataSnapshotId:draft.dataSnapshotId!}});expect(ack.response.status).toBe(202);
 const report=(await c.GET('/v1/backtests/{runId}',{params:{path:{runId:ack.data!.jobId}}})).data!;
 const artifact=(await c.GET('/v1/artifacts/{artifactId}',{params:{path:{artifactId:report.reportArtifactId}}})).data!;
 const reviewed=preparedRelease(report,draft,artifact);
 const release=await c.POST('/v1/releases',{params:{header:header()},body:{strategyId,objectVersion:draft.objectVersion,backtestRunId:report.runId,parameters:draft.parameters}});expect(release.response.status).toBe(201);assertReleaseBinding(checkedRelease(release.data),reviewed);
 releaseId=release.data!.releaseId;
 const submission=await c.POST('/v1/releases/{releaseId}/approval-submissions',{params:{path:{releaseId},header:header(release.data!.objectVersion) as ReturnType<typeof header>&{'If-Match':string}}});expect(submission.response.status).toBe(202);
 await approver.load();await approver.select(submission.data!.jobId);await approver.act('approve','','CONFIRM APPROVE','123456');
 const approved=(await c.GET('/v1/releases/{releaseId}',{params:{path:{releaseId}}})).data!;expect(releaseTargets(approved)).toEqual(['paper','shadow']);expect(approved.contentHash).toBe(release.data!.contentHash);await audit(approver.view.receipt!);
 }else{expect((await c.GET('/v1/strategies')).response.status).toBe(403);}
 let orderId:string|undefined,proposalReleaseId:string|undefined,downloadBytes=0;
 if(mode==='paper'){
 await ticket.load();await ticket.list();const proposal=ticket.view.ticket.rows[0]!,instrument=ticket.view.ticket.instruments.find(i=>i.canonicalSymbol.replace('/','')===proposal.symbol)!;
 proposalReleaseId=proposal.signal.strategyReleaseId;expect(proposalReleaseId).not.toBe(releaseId);
 await ticket.select(proposal.proposalId,instrument.instrumentId,{symbol:proposal.symbol});await ticket.advance();await ticket.advance();await ticket.evaluate('EVALUATE RISK');
 await approver.load();await approver.select(ticket.view.approval!.approvalId);await approver.act('approve','','CONFIRM APPROVE','123456');await ticket.refreshApproval();await ticket.submit('SUBMIT COMMAND');
 orderId=ticket.view.commands.order!.orderId;expect(ticket.view.commands.order?.fills).toEqual([]);expect(ticket.view.commands.order?.releaseId).toBe(proposalReleaseId);await ticket.commands.cancel('CANCEL ORDER');expect(ticket.view.commands.order?.status).toBe('cancelled');await audit(ticket.view.commands.receipt!);
 await expect(p.load()).rejects.toMatchObject({status:403});
 }else{
 const pc=await p.load();await p.refresh({accountId:pc.accountId,currency:'USD',method:'simple',period:'week',periodMode:'rolling'});expect(p.view.links.length).toBe(p.view.data?.series.length);expect(p.view.data?.provisional).toBe(true);
 await p.create();await p.open(p.view.report!.reportId);const downloaded=await p.download();downloadBytes=downloaded.bytes.length;expect(downloadBytes).toBeGreaterThan(0);expect(JSON.parse(new TextDecoder().decode(downloaded.bytes)).performance).toEqual(p.view.document?.performance);await audit(p.view.report!);
 }
 await alerts.load();await alerts.refresh();await alerts.open(alerts.view.items[0]!.id);const alertId=alerts.view.detail!.id;await alerts.act('ack','G7 acknowledge observed source','123456',true);expect(alerts.view.detail?.resolved).toBe(false);await audit(alerts.view.detail!);
 await ops.load();await ops.refresh();await ops.inspectAlert(alertId);await ops.act('open','G7 same source incident','123456',true);expect(ops.view.selected?.mode).toBe(mode);expect(ops.view.selected?.alertId).toBe(alertId);await audit(ops.view.selected!);await ops.act('ack','G7 no source repair claimed','123456',true);expect(ops.view.selected?.status).toBe('acknowledged');await audit(ops.view.selected!);
 await admin.load();await admin.refresh();const role=admin.view.rows.find(r=>r.spec.kind==='role'&&r.spec.baseRole==='viewer')!;
 await admin.act('policies','POST',{kind:'policy',name:'g7_reader_boundary',roleId:role.id,deniedCapabilities:['ops.operate'],active:true},undefined,'G7 role boundary','123456',true);await audit(admin.view.receipts[0]!);
 const viewer=createOperationsRuntime({...s.config(s.transport('session-viewer')),desktop:()=>true});try{await expect(viewer.load()).rejects.toMatchObject({status:403});expect(viewer.view.health).toBeUndefined();}finally{viewer.close();}
 const dir=process.env.QUANTOS_G7_EVIDENCE_DIR;if(dir){mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/${mode}.json`,JSON.stringify({schema:'quantos-g7-reference-composition/v1',sourceCommit:process.env.GITHUB_SHA,binarySha256:'sha256:'+createHash('sha256').update(readFileSync(referenceBffExecutable())).digest('hex'),mode,referenceInstance:s.origin,data:'OWNED_SYNTHETIC_REFERENCE',identity:'EXPLICIT_REFERENCE_SESSION_TRANSPORT',census,researchRunId:run.jobId,researchResult:'QUEUED_THEN_CANCELLED_NO_WORKER_HANDOFF',strategyId,releaseId,proposalReleaseId,orderId,downloadBytes,releaseToProposal:'NOT_JOINED_INDEPENDENT_SEED',paperOrderToShadowLedger:'NOT_RUN_DIFFERENT_MODE_SOURCE',incidentStatus:ops.view.selected?.status,sourceResolved:alerts.view.detail?.resolved,roots,rows:s.rows},null,2)+'\n');}
 }finally{ticket.close();approver.close();portfolio.close();p.close();alerts.close();ops.close();admin.close();await s.close();}
},60000);
