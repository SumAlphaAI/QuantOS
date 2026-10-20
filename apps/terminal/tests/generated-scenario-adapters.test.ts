import { expect, it } from "vitest";
import * as publicApi from "@sumalpha/api-client";
import { createTerminalScenario } from "./fixtures/scenarios/terminal.js";
import { createStrategyScenario } from "./fixtures/scenarios/strategy.js";
import { createExecutionScenario } from "./fixtures/scenarios/execution.js";
import { createOpsScenario } from "./fixtures/scenarios/ops.js";
import { exchange, generatedScenario, scenarioExchanges, uuid } from "./fixtures/scenarios/transport.js";

it('production API exports contain neither four fixtures nor legacy client constructors',()=>{
 for(const name of ['InMemoryTerminalBackend','InMemoryStrategyBackend','InMemoryExecutionBackend','InMemoryOpsBackend','TerminalClient','createTerminalClient']) expect(name in publicApi).toBe(false);
 expect(typeof publicApi.createBffClient).toBe('function');
});
it('all four owning fixtures validate generated operations with accepted and completed observations separated',async()=>{
 const terminal=createTerminalScenario(),strategy=createStrategyScenario(),execution=createExecutionScenario(),ops=createOpsScenario();
 await terminal.getSession();await terminal.getCommandCenter();await terminal.listDataSnapshots();
 const run=await terminal.createResearchRun({title:'scenario',question:'research',capability:'research.hypothesis.v1',dataSnapshotId:'snapshot-btc-2026-07-31',budgetUnits:10,deadlineAt:'2026-08-01T00:10:00Z'});
 await terminal.streamResearchEvents(run.runId,0);await terminal.cancelResearchRun(run.runId);await terminal.getResearchRun(run.runId);
 await strategy.runStaticCheck('strategy-001');await strategy.createBacktest('strategy-001');await strategy.createRelease('strategy-001');
 await execution.getPortfolio('paper-account-0');await execution.getRiskView('paper-account-0');await execution.getProposal('proposal-0001');await execution.getApproval('approval-0001');await execution.getOrder('order-0001');
 await ops.getEvidenceChain('corr-order-0001');await ops.searchAudit('order-0001');await ops.getOperationsView();await ops.getAdminView();
 for(const adapter of [terminal,strategy,execution,ops]){const trace=scenarioExchanges(adapter);expect(trace.length).toBeGreaterThan(2);expect(trace.every(x=>x.validated)).toBe(true);}
 expect(scenarioExchanges(strategy).filter(x=>['createBacktest','getBacktest'].includes(x.operation)).map(x=>[x.operation,x.status])).toEqual([['createBacktest',202],['getBacktest',200]]);
 expect(scenarioExchanges(terminal).some(x=>x.operation==='subscribeResearchRun')).toBe(true);
});
it('generated schema rejects malformed JSON before returning a UI projection',async()=>{
 await expect(exchange({operation:'getSession',status:200,payload:{actorId:'not-uuid'}})).rejects.toBeInstanceOf(publicApi.BffResponseError);
 await expect(exchange({operation:'createBacktest',status:200,payload:{jobId:uuid('job'),status:'accepted'}})).rejects.toBeInstanceOf(publicApi.BffResponseError);
});
it('generated SSE rejects unsupported envelope versions',async()=>{
 await expect(exchange({operation:'subscribeResearchRun',status:200,payload:[{streamId:uuid('stream'),eventId:uuid('event'),sequence:1,occurredAt:'2026-08-01T00:00:00Z',correlationId:uuid('corr'),payloadVersion:'v999',payload:{}}]})).rejects.toThrow();
});
it('new unregistered fixture methods fail closed instead of bypassing generated schemas',async()=>{
 const adapter=generatedScenario('terminal',{async bypass(){return 'unvalidated';}});
 await expect(adapter.bypass()).rejects.toThrow('unmapped scenario method');
 expect(scenarioExchanges(adapter)).toEqual([]);
});
it('fixture instances isolate mutable state and retain fixture-only MFA and self approval rejections',async()=>{
 const a=createExecutionScenario(),b=createExecutionScenario();
 await expect(a.decideApproval('approval-0001','proposal-owner','approved','','bad')).rejects.toThrow();
 await expect(a.engageKillSwitch('global','risk','bad')).rejects.toThrow('MFA');
 await a.engageKillSwitch('global','risk','mfa-scenario');
 expect((await a.getRiskView('paper-account-0')).killSwitchEngaged).toBe(true);
 expect((await b.getRiskView('paper-account-0')).killSwitchEngaged).toBe(false);
});
