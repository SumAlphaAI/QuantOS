/** Explicit projections between historical UI scenario read models and generated BFF schemas.
 * Synthetic worker completion is separate from 202 accepted; none of this fixture grants authority.
 */
import type { BffOperationId, SseEventEnvelope, ResearchStreamEvent, ResearchRunDetail, DataSnapshotSummary, StrategyDraftDetail, StrategyReleaseView, BacktestReport, PortfolioView, RiskView, ProposalDetail, ApprovalDetail, OrderDetail, AuditEventRow, EvidenceChainNode, ExportJob, OperationsView, IncidentDetail, AdminView, CommandCenterView, TerminalSession, StrategySummary } from "@sumalpha/api-client";
import { now, hash, uuid, type Schemas } from "./transport.js";
export interface WireValue { operation: BffOperationId; status: number; payload: unknown }
const wire=(operation:BffOperationId,payload:unknown,status=200):WireValue=>({operation,status,payload});
const ack=(operation:BffOperationId,id:string)=>wire(operation,{jobId:uuid(id),status:"accepted",correlationId:uuid("scenario")} satisfies Schemas["AsyncAccepted"],202);
const researchAck=(operation:"createResearchRun"|"cancelResearchRun",id:string)=>wire(operation,{jobId:uuid(id),status:"accepted",correlationId:uuid("scenario"),statusRef:"/v1/research-runs/"+uuid(id),auditRef:uuid("audit")} satisfies Schemas["ResearchAccepted"],202);
const page=(items:unknown[])=>({items});
const adminPage=(items:unknown[])=>({items,nextCursor:null,configVersion:"1"});
const research=(v:ResearchRunDetail):Schemas["ResearchRun"]=>({runId:uuid(v.runId),capability:v.capability,dataSnapshotId:uuid(v.dataSnapshotId),budget:"100",costUnits:String(v.costUnits??0),deadlineAt:now,status:v.status,inputHash:hash(v.inputHash??v.runId),engineVersion:"scenario-only",evidenceRefs:(v.evidence??[]).map(x=>uuid(x.evidenceId)),artifactRefs:(v.artifactIds??[]).map(uuid),correlationId:uuid(v.correlationId),createdAt:v.createdAt});
const snapshot=(v:DataSnapshotSummary):Schemas["DataSnapshot"]=>({snapshotId:uuid(v.snapshotId),schemaVersion:"1",window:{start:now,end:now},quality:v.quality==='passed'?'verified':v.quality==='pending'?'provisional':v.quality,qualityBlocked:!v.usableForTrading,contentHash:hash(v.contentHash),licenseLabel:v.licenseLabel,capturedAt:v.capturedAt,maxAgeSeconds:86400,sources:v.symbols});
const draft=(v:StrategyDraftDetail):Schemas["StrategyDraft"]=>({strategyId:uuid(v.strategyId),objectVersion:String(v.draftVersion),files:{"strategy.rule":v.rule},parameters:v.parameters,updatedAt:now,dataSnapshotId:uuid(v.dataSnapshotId)});
const report=(v:BacktestReport):Schemas["BacktestReport"]=>({runId:uuid(v.runId),strategyId:uuid(v.strategyId),dataSnapshotId:uuid("snapshot-btc-2026-07-31"),status:"succeeded",metrics:{totalReturn:String(v.totalReturn),maxDrawdown:String(v.maxDrawdown),sharpe:String(v.sharpe),tradeCount:String(v.tradeCount),feesTotal:String(v.feesTotal),slippageTotal:String(v.slippageTotal)},leakViolations:v.leakCheckViolations?['synthetic-leak']:[],reportArtifactId:uuid(v.reportHash),reportHash:hash(v.reportHash)});
const release=(v:StrategyReleaseView):Schemas["StrategyRelease"]=>({releaseId:uuid(v.releaseId),strategyId:uuid(v.strategyId),backtestReportArtifactId:uuid(v.backtestReportHash),sourceDigest:hash(v.contentHash),imageDigest:hash("scenario-image"),parameterHash:hash("scenario-parameters"),parameters:{},snapshotId:uuid("snapshot-btc-2026-07-31"),allowedTargets:v.allowedTargets.filter(x=>x.enabled).map(x=>x.target),approvalState:v.approvalState==='conflict'?'approved':v.approvalState,createdAt:v.createdAt,approvalTimeline:[]});
const approval=(v:ApprovalDetail):Schemas["Approval"]=>({approvalId:uuid(v.approvalId),originator:v.originator,objectVersion:"1",status:v.status,expiresAt:now,correlationId:uuid("scenario"),...(v.commandId?{commandRef:uuid(v.commandId)}:{})});
const order=(v:OrderDetail):Schemas["Order"]=>({orderId:uuid(v.orderId),commandId:uuid(v.commandId),accountId:uuid(v.accountId??"paper-account-0"),venue:"scenario-mock",venueKind:"mock",symbol:v.symbol,intent:"open",side:v.side==='sell'?'sell':'buy',quantity:String(v.filledQuantity),status:v.status,filledQuantity:String(v.filledQuantity),averageFillPrice:String(v.averageFillPrice??0),fills:(v.fills??[]).map(f=>({fillId:uuid(f.fillId),quantity:String(f.quantity),price:String(f.price),at:f.at})),mode:v.mode,correlationId:uuid("scenario"),submittedAt:v.submittedAt});
const portfolio=(v:PortfolioView):Schemas["PortfolioView"]=>({accountId:uuid(v.accountId),asOf:v.asOf,stale:v.stale,positions:v.positions.map(p=>({symbol:p.symbol,side:p.quantity>=0?'long':'short',quantity:String(p.quantity),avgPrice:String(p.averageEntryPrice)})),pnl:{currencyCode:"USD",units:String(Math.trunc(v.realizedPnl)),nanos:Math.round((v.realizedPnl%1)*1e9)},exposure:String(v.exposureGross)});
const risk=(v:RiskView):Schemas["RiskView"]=>({accountId:uuid("paper-account-0"),asOf:v.asOf,hitRules:v.blockingEvents.map(x=>x.ruleId),limitIds:[],killSwitch:{state:v.killSwitchEngaged?'engaged':'disengaged'}});
const proposal=(v:ProposalDetail):Schemas["TradeProposal"]=>({proposalId:uuid(v.proposalId),accountId:uuid("paper-account-0"),symbol:v.symbol,action:v.side==='sell'?'sell':'buy',quantity:"1",notional:String(v.notional),signal:{signalId:uuid("signal"),strategyReleaseId:uuid("release-0001"),symbol:v.symbol,direction:"long",strength:"1",confidence:"1",generatedAt:now,validUntil:v.expiresAt},rationale:v.summary,counterViews:v.counterViews,evidenceRefs:v.evidence.map(x=>uuid(x.evidenceId)),confidence:"1",expiresAt:v.expiresAt,executable:false,objectVersion:"1"});
const audit=(v:AuditEventRow,i:number):Schemas["AuditEvent"]=>({eventId:uuid(v.eventId),correlationId:uuid(v.correlationId),sequence:i+1,kind:v.kind,actor:v.actor,objectRef:v.objectRef,occurredAt:v.at,redactionApplied:true,redactedPayload:v.redactedPayload,payloadHash:hash(JSON.stringify(v.redactedPayload)),retentionUntil:now});
const exportJob=(v:ExportJob):Schemas["ExportJob"]=>({exportId:uuid(v.exportId),status:v.status,format:"jsonl",requestedBy:v.requestedBy,requestedAt:v.requestedAt,watermark:"scenario-only",retentionUntil:now,correlationId:uuid("scenario"),auditRef:uuid("audit")});
const health=(v:OperationsView):Schemas["OpsHealth"]=>({service:"service-x06",health:v.degraded?'degraded':'healthy',ready:!v.degraded,objectVersion:"1",sourceHash:hash("scenario-source"),asOf:now,expiresAt:now,accountId:uuid("paper-account-0"),mode:"paper",latencyMs:v.services[0]?.latencyMs??0,dlqDepth:v.deadLetterCount,metricsHash:hash("scenario-metrics"),components:[]});
const incident=(v:IncidentDetail):Schemas["OpsIncident"]=>({id:uuid(v.incidentId),incidentId:uuid(v.incidentId),sourceRef:hash(v.title),alertId:uuid("alert-1"),status:"open",objectVersion:"1",openedSource:"1",asOf:now,accountId:uuid("paper-account-0"),mode:"paper"});
const members=(v:AdminView):Schemas["AdminResource"][]=>v.members.map(m=>({id:uuid(m.memberId),kind:"members",objectVersion:"1",configVersion:"1",deleted:!m.active,protected:m.role==='admin',spec:{kind:"member",actorId:uuid(m.memberId),roleId:uuid(m.role),active:m.active}}));
export function projectScenario(domain:string,method:string,args:unknown[],v:unknown):WireValue[]{
 const key=domain+'.'+method;
 switch(key){
 case 'terminal.getSession': {const s=v as TerminalSession;return[wire('getSession',{actorId:uuid(s.actorId),tenantId:uuid('tenant'),workspaceId:uuid(s.workspaceId),accountId:uuid('paper-account-0'),mode:'paper',environment:'dev',capabilities:s.capabilities,mfaState:s.mfaSatisfied?'verified':'unenrolled',expiresAt:now} satisfies Schemas['SessionContext'])];}
 case 'terminal.getCommandCenter':{const c=v as CommandCenterView;return[wire('getCommandSummary',{accountId:uuid('paper-account-0'),mode:'paper',sampledAt:c.sampledAt,asOf:c.sampledAt,expiresAt:now,revision:hash('scenario-command'),partial:false,dataFreshness:'fresh',riskPosture:'normal',systemHealth:'healthy',pendingApprovals:c.pendingApprovals,failedRuns:c.failedRuns,runningRuns:0,openRiskAlerts:c.openRiskAlerts,orderSummary:{mode:'paper',submitted:0,filled:0,rejected:0},priority:[],recentActivity:[],sources:(['research','execution','operations','strategy'] as const).map(domain=>({domain,status:'ready',asOf:now,sourceHash:hash(domain)})),bounded:{sourceCount:4,rowLimit:2000,itemLimit:50,truncated:false}} satisfies Schemas['CommandSummary'])];}
 case 'terminal.listResearchRuns':return[wire('listResearchRuns',page((v as ResearchRunDetail[]).map(research)))];
 case 'terminal.createResearchRun':return[researchAck('createResearchRun',(v as ResearchRunDetail).runId),wire('getResearchRun',research(v as ResearchRunDetail))];
 case 'terminal.getResearchRun':return[wire('getResearchRun',research(v as ResearchRunDetail))];
 case 'terminal.cancelResearchRun':return[researchAck('cancelResearchRun',String(args[0]))];
 case 'terminal.streamResearchEvents':return[wire('subscribeResearchRun',(v as ResearchStreamEvent[]).map(e=>({streamId:uuid(String(args[0])),sequence:e.sequence,eventId:uuid(String(args[0])+e.sequence),occurredAt:now,correlationId:uuid("scenario"),payloadVersion:"v1",payload:{type:e.phase,done:e.done,...e.payload}} satisfies SseEventEnvelope)))];
 case 'terminal.listDataSnapshots':return[wire('listDataSnapshots',page((v as DataSnapshotSummary[]).map(snapshot)))];
 case 'terminal.getDataSnapshot':return[wire('getDataSnapshot',snapshot(v as DataSnapshotSummary))];
 case 'strategy.getAssistedLiveTestnetFlag':return[wire('listFeatureFlags',adminPage([{id:uuid('scenario-flag'),kind:'feature-flags',objectVersion:'1',configVersion:'1',deleted:false,protected:false,spec:{kind:'flag',name:'admin-catalog-preview',enabled:v as boolean,rolloutPercent:100}} satisfies Schemas['AdminResource']]))];
 case 'strategy.listStrategies':return[wire('listStrategies',page((v as StrategySummary[]).map(s=>({strategyId:uuid(s.strategyId),name:s.name,updatedAt:s.updatedAt} satisfies Schemas['StrategySummary']))))];
 case 'strategy.getStrategyDraft':return[wire('getStrategyDraft',draft(v as StrategyDraftDetail))];
 case 'strategy.runStaticCheck':return[ack('runStaticCheck',String(args[0]))];
 case 'strategy.createBacktest':return[ack('createBacktest',(v as BacktestReport).runId),wire('getBacktest',report(v as BacktestReport))];
 case 'strategy.getBacktest':return[wire('getBacktest',report(v as BacktestReport))];
 case 'strategy.createRelease':return[wire('createRelease',release(v as StrategyReleaseView),201)];
 case 'strategy.getRelease':return[wire('getRelease',release(v as StrategyReleaseView))];
 case 'strategy.listReleases':return[wire('listReleases',page((v as StrategyReleaseView[]).map(release)))];
 case 'strategy.approveRelease': case 'strategy.rejectRelease':return[wire('getRelease',release(v as StrategyReleaseView))]; // Approval UI projection, not an execution-authority simulation.
 case 'execution.getPortfolio':return[wire('getPortfolio',portfolio(v as PortfolioView))];
 case 'execution.getRiskView':case 'execution.engageKillSwitch':return[wire('getRiskView',risk(v as RiskView))];
 case 'execution.listProposals':return[wire('listProposals',page((v as ProposalDetail[]).map(proposal)))];
 case 'execution.getProposal':return[wire('getProposal',proposal(v as ProposalDetail))];
 case 'execution.requestRiskEvaluation':return[ack('requestRiskEvaluation',String(args[0]))];
 case 'execution.listApprovals':return[wire('listApprovals',page((v as ApprovalDetail[]).map(approval)))];
 case 'execution.getApproval':case 'execution.decideApproval':return[wire('getApproval',approval(v as ApprovalDetail))];
 case 'execution.listOrders':return[wire('listOrders',page((v as OrderDetail[]).map(order)))];
 case 'execution.getOrder':case 'execution.requestOrderCancel':return[wire('getOrder',order(v as OrderDetail))];
 case 'ops.searchAudit':return[wire('searchAuditEvents',page((v as AuditEventRow[]).map(audit)))];
 case 'ops.getEvidenceChain':return[wire('getEvidenceChain',{correlationId:uuid(String(args[0])),items:(v as EvidenceChainNode[]).map(n=>({eventId:uuid(n.ref),sequence:1,kind:n.kind,objectRef:n.ref,occurredAt:now,payloadHash:hash(n.hash),route:n.route,retentionUntil:now})),complete:true})];
 case 'ops.createExportJob':return[wire('createExport',exportJob(v as ExportJob),202)];
 case 'ops.getExportJob':return[wire('getExportStatus',exportJob(v as ExportJob))];
 case 'ops.getOperationsView':return[wire('getServiceHealth',health(v as OperationsView))];
 case 'ops.getIncident':case 'ops.runRunbookAction':return[wire('getIncident',incident(v as IncidentDetail))];
 case 'ops.getAdminView':case 'ops.deactivateMember':return[wire('listMembers',adminPage(members(v as AdminView)))];
 default:throw Error('unmapped scenario method '+key);
 }
}
