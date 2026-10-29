/* eslint-disable */
// Generated from bff/openapi/quantos-bff.v1.yaml (1.24.0). Do not edit.
import { http, HttpResponse, type PathParams } from "msw";

export interface BffMockResolverContext {
  request: Request;
  params: PathParams;
}

export type BffMockResolver = (context: BffMockResolverContext) => Response | Promise<Response>;
export type BffMockResolvers = Partial<Record<BffOperationId, BffMockResolver>>;

export type BffOperationId =
  | "ackAlert"
  | "ackIncident"
  | "approveAssistedKillRelease"
  | "approveAssistedRequest"
  | "cancelExport"
  | "cancelResearchRun"
  | "checkRunbookPreconditions"
  | "createBacktest"
  | "createCapability"
  | "createExport"
  | "createFeatureFlag"
  | "createMember"
  | "createPerformanceReport"
  | "createPolicy"
  | "createRelease"
  | "createResearchRun"
  | "createRole"
  | "decideApproval"
  | "deleteCapability"
  | "deleteFeatureFlag"
  | "deleteMember"
  | "deletePolicy"
  | "deleteRole"
  | "downloadPerformanceReport"
  | "engageKillSwitch"
  | "getAlert"
  | "getAlertSubscriptions"
  | "getApproval"
  | "getArtifact"
  | "getArtifactAttachment"
  | "getAssistedActivationHistory"
  | "getAssistedApprovalAudit"
  | "getAssistedCurrentReconciliation"
  | "getAssistedKillControls"
  | "getAssistedNativeCapabilities"
  | "getAssistedNativeLedger"
  | "getAssistedNativeValuation"
  | "getAssistedRequest"
  | "getBacktest"
  | "getCandleSeries"
  | "getCapability"
  | "getCommandSummary"
  | "getContext"
  | "getDataSnapshot"
  | "getEvidenceChain"
  | "getExportDownload"
  | "getExportStatus"
  | "getFeatureFlag"
  | "getIncident"
  | "getIncidentTimeline"
  | "getMarketCatalog"
  | "getMember"
  | "getNotificationPrefs"
  | "getOrder"
  | "getOrderCapabilities"
  | "getPerformanceAttribution"
  | "getPerformanceReport"
  | "getPerformanceSeries"
  | "getPerformanceSummary"
  | "getPlatformCapabilities"
  | "getPolicy"
  | "getPortfolio"
  | "getProfile"
  | "getProposal"
  | "getReconciliationBreak"
  | "getReconciliationRun"
  | "getRelease"
  | "getReportDownload"
  | "getReportStatus"
  | "getResearchRun"
  | "getRiskView"
  | "getRole"
  | "getSecuritySettings"
  | "getServiceHealth"
  | "getServiceMetrics"
  | "getSession"
  | "getStrategyDraft"
  | "getTradePreflight"
  | "getVenueQuotes"
  | "getWatchlist"
  | "listAlerts"
  | "listApprovals"
  | "listAssistedRequests"
  | "listAssistedSubjects"
  | "listCapabilities"
  | "listDataSnapshots"
  | "listDevices"
  | "listDownloads"
  | "listFeatureFlags"
  | "listIncidents"
  | "listLedgerEntries"
  | "listMembers"
  | "listOrders"
  | "listPolicies"
  | "listProposals"
  | "listReconciliationBreaks"
  | "listReconciliationRuns"
  | "listReleases"
  | "listResearchRuns"
  | "listRoles"
  | "listRunbookActions"
  | "listSessions"
  | "listStrategies"
  | "logout"
  | "mfaChallenge"
  | "openAssistedRequest"
  | "openIncident"
  | "reauth"
  | "releaseKillSwitch"
  | "requestOrderCancel"
  | "requestReconciliationRerun"
  | "requestReleaseRollback"
  | "requestRiskEvaluation"
  | "resolveIncident"
  | "revokeDevice"
  | "revokeMfaFactor"
  | "revokeSession"
  | "runApprovedRunbookAction"
  | "runStaticCheck"
  | "saveAlertSubscriptions"
  | "saveCapability"
  | "saveFeatureFlag"
  | "saveNotificationPrefs"
  | "savePolicy"
  | "saveProfile"
  | "saveRole"
  | "saveStrategyDraft"
  | "saveWatchlist"
  | "searchAuditEvents"
  | "setupMfa"
  | "submitAccessRequest"
  | "submitAssistedRequest"
  | "submitReleaseApproval"
  | "submitTradeCommand"
  | "subscribeAlerts"
  | "subscribeBacktestRun"
  | "subscribeCandles"
  | "subscribeCommandEvents"
  | "subscribeOrder"
  | "subscribePortfolio"
  | "subscribeProposal"
  | "subscribeQuotes"
  | "subscribeReconciliationRun"
  | "subscribeResearchRun"
  | "subscribeSessionRevocations"
  | "subscribeTradePreflight"
  | "unackAlert"
  | "updateMember";

function missingResolver(operationId: BffOperationId): Response {
  return HttpResponse.json(
    { code: "MOCK_NOT_CONFIGURED", message: `No fixture configured for ${operationId}.`, correlationId: "00000000-0000-4000-8000-000000000000" },
    { status: 501, headers: { "X-Correlation-Id": "00000000-0000-4000-8000-000000000000", "Cache-Control": "no-store" } },
  );
}

export function createGeneratedBffHandlers(
  resolvers: BffMockResolvers,
  baseUrl = "http://localhost:4010",
) {
  return [
  http.post(`${baseUrl}/v1/alerts/:alertId/ack`, async ({ request, params }) => {
    const resolver = resolvers.ackAlert;
    if (resolver) return resolver({ request, params });
    return missingResolver("ackAlert");
  }),
  http.post(`${baseUrl}/v1/operations/incidents/:incidentId/ack`, async ({ request, params }) => {
    const resolver = resolvers.ackIncident;
    if (resolver) return resolver({ request, params });
    return missingResolver("ackIncident");
  }),
  http.post(`${baseUrl}/v1/risk/kill-switch/release-approvals`, async ({ request, params }) => {
    const resolver = resolvers.approveAssistedKillRelease;
    if (resolver) return resolver({ request, params });
    return missingResolver("approveAssistedKillRelease");
  }),
  http.post(`${baseUrl}/v1/assisted-testnet/requests/:requestId/approvals`, async ({ request, params }) => {
    const resolver = resolvers.approveAssistedRequest;
    if (resolver) return resolver({ request, params });
    return missingResolver("approveAssistedRequest");
  }),
  http.post(`${baseUrl}/v1/exports/:exportId/cancel`, async ({ request, params }) => {
    const resolver = resolvers.cancelExport;
    if (resolver) return resolver({ request, params });
    return missingResolver("cancelExport");
  }),
  http.post(`${baseUrl}/v1/research-runs/:runId/cancel`, async ({ request, params }) => {
    const resolver = resolvers.cancelResearchRun;
    if (resolver) return resolver({ request, params });
    return missingResolver("cancelResearchRun");
  }),
  http.get(`${baseUrl}/v1/operations/runbook-actions/:actionId/prechecks`, async ({ request, params }) => {
    const resolver = resolvers.checkRunbookPreconditions;
    if (resolver) return resolver({ request, params });
    return missingResolver("checkRunbookPreconditions");
  }),
  http.post(`${baseUrl}/v1/backtests`, async ({ request, params }) => {
    const resolver = resolvers.createBacktest;
    if (resolver) return resolver({ request, params });
    return missingResolver("createBacktest");
  }),
  http.post(`${baseUrl}/v1/admin/capabilities`, async ({ request, params }) => {
    const resolver = resolvers.createCapability;
    if (resolver) return resolver({ request, params });
    return missingResolver("createCapability");
  }),
  http.post(`${baseUrl}/v1/exports`, async ({ request, params }) => {
    const resolver = resolvers.createExport;
    if (resolver) return resolver({ request, params });
    return missingResolver("createExport");
  }),
  http.post(`${baseUrl}/v1/admin/feature-flags`, async ({ request, params }) => {
    const resolver = resolvers.createFeatureFlag;
    if (resolver) return resolver({ request, params });
    return missingResolver("createFeatureFlag");
  }),
  http.post(`${baseUrl}/v1/admin/members`, async ({ request, params }) => {
    const resolver = resolvers.createMember;
    if (resolver) return resolver({ request, params });
    return missingResolver("createMember");
  }),
  http.post(`${baseUrl}/v1/performance/reports`, async ({ request, params }) => {
    const resolver = resolvers.createPerformanceReport;
    if (resolver) return resolver({ request, params });
    return missingResolver("createPerformanceReport");
  }),
  http.post(`${baseUrl}/v1/admin/policies`, async ({ request, params }) => {
    const resolver = resolvers.createPolicy;
    if (resolver) return resolver({ request, params });
    return missingResolver("createPolicy");
  }),
  http.post(`${baseUrl}/v1/releases`, async ({ request, params }) => {
    const resolver = resolvers.createRelease;
    if (resolver) return resolver({ request, params });
    return missingResolver("createRelease");
  }),
  http.post(`${baseUrl}/v1/research-runs`, async ({ request, params }) => {
    const resolver = resolvers.createResearchRun;
    if (resolver) return resolver({ request, params });
    return missingResolver("createResearchRun");
  }),
  http.post(`${baseUrl}/v1/admin/roles`, async ({ request, params }) => {
    const resolver = resolvers.createRole;
    if (resolver) return resolver({ request, params });
    return missingResolver("createRole");
  }),
  http.post(`${baseUrl}/v1/approvals/:approvalId/decisions`, async ({ request, params }) => {
    const resolver = resolvers.decideApproval;
    if (resolver) return resolver({ request, params });
    return missingResolver("decideApproval");
  }),
  http.delete(`${baseUrl}/v1/admin/capabilities/:resourceId`, async ({ request, params }) => {
    const resolver = resolvers.deleteCapability;
    if (resolver) return resolver({ request, params });
    return missingResolver("deleteCapability");
  }),
  http.delete(`${baseUrl}/v1/admin/feature-flags/:resourceId`, async ({ request, params }) => {
    const resolver = resolvers.deleteFeatureFlag;
    if (resolver) return resolver({ request, params });
    return missingResolver("deleteFeatureFlag");
  }),
  http.delete(`${baseUrl}/v1/admin/members/:resourceId`, async ({ request, params }) => {
    const resolver = resolvers.deleteMember;
    if (resolver) return resolver({ request, params });
    return missingResolver("deleteMember");
  }),
  http.delete(`${baseUrl}/v1/admin/policies/:resourceId`, async ({ request, params }) => {
    const resolver = resolvers.deletePolicy;
    if (resolver) return resolver({ request, params });
    return missingResolver("deletePolicy");
  }),
  http.delete(`${baseUrl}/v1/admin/roles/:resourceId`, async ({ request, params }) => {
    const resolver = resolvers.deleteRole;
    if (resolver) return resolver({ request, params });
    return missingResolver("deleteRole");
  }),
  http.get(`${baseUrl}/v1/performance/reports/:reportId/content`, async ({ request, params }) => {
    const resolver = resolvers.downloadPerformanceReport;
    if (resolver) return resolver({ request, params });
    return missingResolver("downloadPerformanceReport");
  }),
  http.post(`${baseUrl}/v1/risk/kill-switch/engage`, async ({ request, params }) => {
    const resolver = resolvers.engageKillSwitch;
    if (resolver) return resolver({ request, params });
    return missingResolver("engageKillSwitch");
  }),
  http.get(`${baseUrl}/v1/alerts/:alertId`, async ({ request, params }) => {
    const resolver = resolvers.getAlert;
    if (resolver) return resolver({ request, params });
    return missingResolver("getAlert");
  }),
  http.get(`${baseUrl}/v1/alerts/subscriptions`, async ({ request, params }) => {
    const resolver = resolvers.getAlertSubscriptions;
    if (resolver) return resolver({ request, params });
    return missingResolver("getAlertSubscriptions");
  }),
  http.get(`${baseUrl}/v1/approvals/:approvalId`, async ({ request, params }) => {
    const resolver = resolvers.getApproval;
    if (resolver) return resolver({ request, params });
    return missingResolver("getApproval");
  }),
  http.get(`${baseUrl}/v1/artifacts/:artifactId`, async ({ request, params }) => {
    const resolver = resolvers.getArtifact;
    if (resolver) return resolver({ request, params });
    return missingResolver("getArtifact");
  }),
  http.get(`${baseUrl}/v1/artifacts/:artifactId/attachment`, async ({ request, params }) => {
    const resolver = resolvers.getArtifactAttachment;
    if (resolver) return resolver({ request, params });
    return missingResolver("getArtifactAttachment");
  }),
  http.get(`${baseUrl}/v1/admin/feature-flags/:resourceId/history`, async ({ request, params }) => {
    const resolver = resolvers.getAssistedActivationHistory;
    if (resolver) return resolver({ request, params });
    return missingResolver("getAssistedActivationHistory");
  }),
  http.get(`${baseUrl}/v1/assisted-testnet/requests/:requestId/audit`, async ({ request, params }) => {
    const resolver = resolvers.getAssistedApprovalAudit;
    if (resolver) return resolver({ request, params });
    return missingResolver("getAssistedApprovalAudit");
  }),
  http.get(`${baseUrl}/v1/assisted-testnet/reconciliation`, async ({ request, params }) => {
    const resolver = resolvers.getAssistedCurrentReconciliation;
    if (resolver) return resolver({ request, params });
    return missingResolver("getAssistedCurrentReconciliation");
  }),
  http.get(`${baseUrl}/v1/risk/kill-switch`, async ({ request, params }) => {
    const resolver = resolvers.getAssistedKillControls;
    if (resolver) return resolver({ request, params });
    return missingResolver("getAssistedKillControls");
  }),
  http.get(`${baseUrl}/v1/assisted-testnet/capabilities`, async ({ request, params }) => {
    const resolver = resolvers.getAssistedNativeCapabilities;
    if (resolver) return resolver({ request, params });
    return missingResolver("getAssistedNativeCapabilities");
  }),
  http.get(`${baseUrl}/v1/assisted-testnet/ledger`, async ({ request, params }) => {
    const resolver = resolvers.getAssistedNativeLedger;
    if (resolver) return resolver({ request, params });
    return missingResolver("getAssistedNativeLedger");
  }),
  http.get(`${baseUrl}/v1/assisted-testnet/valuation`, async ({ request, params }) => {
    const resolver = resolvers.getAssistedNativeValuation;
    if (resolver) return resolver({ request, params });
    return missingResolver("getAssistedNativeValuation");
  }),
  http.get(`${baseUrl}/v1/assisted-testnet/requests/:requestId`, async ({ request, params }) => {
    const resolver = resolvers.getAssistedRequest;
    if (resolver) return resolver({ request, params });
    return missingResolver("getAssistedRequest");
  }),
  http.get(`${baseUrl}/v1/backtests/:runId`, async ({ request, params }) => {
    const resolver = resolvers.getBacktest;
    if (resolver) return resolver({ request, params });
    return missingResolver("getBacktest");
  }),
  http.get(`${baseUrl}/v1/markets/candles`, async ({ request, params }) => {
    const resolver = resolvers.getCandleSeries;
    if (resolver) return resolver({ request, params });
    return missingResolver("getCandleSeries");
  }),
  http.get(`${baseUrl}/v1/admin/capabilities/:resourceId`, async ({ request, params }) => {
    const resolver = resolvers.getCapability;
    if (resolver) return resolver({ request, params });
    return missingResolver("getCapability");
  }),
  http.get(`${baseUrl}/v1/command/summary`, async ({ request, params }) => {
    const resolver = resolvers.getCommandSummary;
    if (resolver) return resolver({ request, params });
    return missingResolver("getCommandSummary");
  }),
  http.get(`${baseUrl}/v1/context`, async ({ request, params }) => {
    const resolver = resolvers.getContext;
    if (resolver) return resolver({ request, params });
    return missingResolver("getContext");
  }),
  http.get(`${baseUrl}/v1/data-snapshots/:snapshotId`, async ({ request, params }) => {
    const resolver = resolvers.getDataSnapshot;
    if (resolver) return resolver({ request, params });
    return missingResolver("getDataSnapshot");
  }),
  http.get(`${baseUrl}/v1/audit/evidence-chains/:correlationId`, async ({ request, params }) => {
    const resolver = resolvers.getEvidenceChain;
    if (resolver) return resolver({ request, params });
    return missingResolver("getEvidenceChain");
  }),
  http.get(`${baseUrl}/v1/exports/:exportId/download`, async ({ request, params }) => {
    const resolver = resolvers.getExportDownload;
    if (resolver) return resolver({ request, params });
    return missingResolver("getExportDownload");
  }),
  http.get(`${baseUrl}/v1/exports/:exportId`, async ({ request, params }) => {
    const resolver = resolvers.getExportStatus;
    if (resolver) return resolver({ request, params });
    return missingResolver("getExportStatus");
  }),
  http.get(`${baseUrl}/v1/admin/feature-flags/:resourceId`, async ({ request, params }) => {
    const resolver = resolvers.getFeatureFlag;
    if (resolver) return resolver({ request, params });
    return missingResolver("getFeatureFlag");
  }),
  http.get(`${baseUrl}/v1/operations/incidents/:incidentId`, async ({ request, params }) => {
    const resolver = resolvers.getIncident;
    if (resolver) return resolver({ request, params });
    return missingResolver("getIncident");
  }),
  http.get(`${baseUrl}/v1/operations/incidents/:incidentId/timeline`, async ({ request, params }) => {
    const resolver = resolvers.getIncidentTimeline;
    if (resolver) return resolver({ request, params });
    return missingResolver("getIncidentTimeline");
  }),
  http.get(`${baseUrl}/v1/markets/catalog`, async ({ request, params }) => {
    const resolver = resolvers.getMarketCatalog;
    if (resolver) return resolver({ request, params });
    return missingResolver("getMarketCatalog");
  }),
  http.get(`${baseUrl}/v1/admin/members/:resourceId`, async ({ request, params }) => {
    const resolver = resolvers.getMember;
    if (resolver) return resolver({ request, params });
    return missingResolver("getMember");
  }),
  http.get(`${baseUrl}/v1/settings/notification-preferences`, async ({ request, params }) => {
    const resolver = resolvers.getNotificationPrefs;
    if (resolver) return resolver({ request, params });
    return missingResolver("getNotificationPrefs");
  }),
  http.get(`${baseUrl}/v1/orders/:orderId`, async ({ request, params }) => {
    const resolver = resolvers.getOrder;
    if (resolver) return resolver({ request, params });
    return missingResolver("getOrder");
  }),
  http.get(`${baseUrl}/v1/order-capabilities`, async ({ request, params }) => {
    const resolver = resolvers.getOrderCapabilities;
    if (resolver) return resolver({ request, params });
    return missingResolver("getOrderCapabilities");
  }),
  http.get(`${baseUrl}/v1/performance/attribution`, async ({ request, params }) => {
    const resolver = resolvers.getPerformanceAttribution;
    if (resolver) return resolver({ request, params });
    return missingResolver("getPerformanceAttribution");
  }),
  http.get(`${baseUrl}/v1/performance/reports/:reportId`, async ({ request, params }) => {
    const resolver = resolvers.getPerformanceReport;
    if (resolver) return resolver({ request, params });
    return missingResolver("getPerformanceReport");
  }),
  http.get(`${baseUrl}/v1/performance/series`, async ({ request, params }) => {
    const resolver = resolvers.getPerformanceSeries;
    if (resolver) return resolver({ request, params });
    return missingResolver("getPerformanceSeries");
  }),
  http.get(`${baseUrl}/v1/performance/summary`, async ({ request, params }) => {
    const resolver = resolvers.getPerformanceSummary;
    if (resolver) return resolver({ request, params });
    return missingResolver("getPerformanceSummary");
  }),
  http.get(`${baseUrl}/v1/platform/browser-capabilities`, async ({ request, params }) => {
    const resolver = resolvers.getPlatformCapabilities;
    if (resolver) return resolver({ request, params });
    return missingResolver("getPlatformCapabilities");
  }),
  http.get(`${baseUrl}/v1/admin/policies/:resourceId`, async ({ request, params }) => {
    const resolver = resolvers.getPolicy;
    if (resolver) return resolver({ request, params });
    return missingResolver("getPolicy");
  }),
  http.get(`${baseUrl}/v1/portfolio`, async ({ request, params }) => {
    const resolver = resolvers.getPortfolio;
    if (resolver) return resolver({ request, params });
    return missingResolver("getPortfolio");
  }),
  http.get(`${baseUrl}/v1/settings/profile`, async ({ request, params }) => {
    const resolver = resolvers.getProfile;
    if (resolver) return resolver({ request, params });
    return missingResolver("getProfile");
  }),
  http.get(`${baseUrl}/v1/proposals/:proposalId`, async ({ request, params }) => {
    const resolver = resolvers.getProposal;
    if (resolver) return resolver({ request, params });
    return missingResolver("getProposal");
  }),
  http.get(`${baseUrl}/v1/reconciliation/breaks/:breakId`, async ({ request, params }) => {
    const resolver = resolvers.getReconciliationBreak;
    if (resolver) return resolver({ request, params });
    return missingResolver("getReconciliationBreak");
  }),
  http.get(`${baseUrl}/v1/reconciliation/runs/:runId`, async ({ request, params }) => {
    const resolver = resolvers.getReconciliationRun;
    if (resolver) return resolver({ request, params });
    return missingResolver("getReconciliationRun");
  }),
  http.get(`${baseUrl}/v1/releases/:releaseId`, async ({ request, params }) => {
    const resolver = resolvers.getRelease;
    if (resolver) return resolver({ request, params });
    return missingResolver("getRelease");
  }),
  http.get(`${baseUrl}/v1/performance/reports/:reportId/download`, async ({ request, params }) => {
    const resolver = resolvers.getReportDownload;
    if (resolver) return resolver({ request, params });
    return missingResolver("getReportDownload");
  }),
  http.get(`${baseUrl}/v1/performance/reports/:reportId/status`, async ({ request, params }) => {
    const resolver = resolvers.getReportStatus;
    if (resolver) return resolver({ request, params });
    return missingResolver("getReportStatus");
  }),
  http.get(`${baseUrl}/v1/research-runs/:runId`, async ({ request, params }) => {
    const resolver = resolvers.getResearchRun;
    if (resolver) return resolver({ request, params });
    return missingResolver("getResearchRun");
  }),
  http.get(`${baseUrl}/v1/risk`, async ({ request, params }) => {
    const resolver = resolvers.getRiskView;
    if (resolver) return resolver({ request, params });
    return missingResolver("getRiskView");
  }),
  http.get(`${baseUrl}/v1/admin/roles/:resourceId`, async ({ request, params }) => {
    const resolver = resolvers.getRole;
    if (resolver) return resolver({ request, params });
    return missingResolver("getRole");
  }),
  http.get(`${baseUrl}/v1/settings/security`, async ({ request, params }) => {
    const resolver = resolvers.getSecuritySettings;
    if (resolver) return resolver({ request, params });
    return missingResolver("getSecuritySettings");
  }),
  http.get(`${baseUrl}/v1/operations/health`, async ({ request, params }) => {
    const resolver = resolvers.getServiceHealth;
    if (resolver) return resolver({ request, params });
    return missingResolver("getServiceHealth");
  }),
  http.get(`${baseUrl}/v1/operations/metrics`, async ({ request, params }) => {
    const resolver = resolvers.getServiceMetrics;
    if (resolver) return resolver({ request, params });
    return missingResolver("getServiceMetrics");
  }),
  http.get(`${baseUrl}/v1/session`, async ({ request, params }) => {
    const resolver = resolvers.getSession;
    if (resolver) return resolver({ request, params });
    return missingResolver("getSession");
  }),
  http.get(`${baseUrl}/v1/strategies/:strategyId/draft`, async ({ request, params }) => {
    const resolver = resolvers.getStrategyDraft;
    if (resolver) return resolver({ request, params });
    return missingResolver("getStrategyDraft");
  }),
  http.get(`${baseUrl}/v1/trade-preflight`, async ({ request, params }) => {
    const resolver = resolvers.getTradePreflight;
    if (resolver) return resolver({ request, params });
    return missingResolver("getTradePreflight");
  }),
  http.get(`${baseUrl}/v1/markets/quotes`, async ({ request, params }) => {
    const resolver = resolvers.getVenueQuotes;
    if (resolver) return resolver({ request, params });
    return missingResolver("getVenueQuotes");
  }),
  http.get(`${baseUrl}/v1/markets/watchlist`, async ({ request, params }) => {
    const resolver = resolvers.getWatchlist;
    if (resolver) return resolver({ request, params });
    return missingResolver("getWatchlist");
  }),
  http.get(`${baseUrl}/v1/alerts`, async ({ request, params }) => {
    const resolver = resolvers.listAlerts;
    if (resolver) return resolver({ request, params });
    return missingResolver("listAlerts");
  }),
  http.get(`${baseUrl}/v1/approvals`, async ({ request, params }) => {
    const resolver = resolvers.listApprovals;
    if (resolver) return resolver({ request, params });
    return missingResolver("listApprovals");
  }),
  http.get(`${baseUrl}/v1/assisted-testnet/requests`, async ({ request, params }) => {
    const resolver = resolvers.listAssistedRequests;
    if (resolver) return resolver({ request, params });
    return missingResolver("listAssistedRequests");
  }),
  http.get(`${baseUrl}/v1/assisted-testnet/subjects`, async ({ request, params }) => {
    const resolver = resolvers.listAssistedSubjects;
    if (resolver) return resolver({ request, params });
    return missingResolver("listAssistedSubjects");
  }),
  http.get(`${baseUrl}/v1/admin/capabilities`, async ({ request, params }) => {
    const resolver = resolvers.listCapabilities;
    if (resolver) return resolver({ request, params });
    return missingResolver("listCapabilities");
  }),
  http.get(`${baseUrl}/v1/data-snapshots`, async ({ request, params }) => {
    const resolver = resolvers.listDataSnapshots;
    if (resolver) return resolver({ request, params });
    return missingResolver("listDataSnapshots");
  }),
  http.get(`${baseUrl}/v1/settings/trusted-devices`, async ({ request, params }) => {
    const resolver = resolvers.listDevices;
    if (resolver) return resolver({ request, params });
    return missingResolver("listDevices");
  }),
  http.get(`${baseUrl}/v1/settings/downloads`, async ({ request, params }) => {
    const resolver = resolvers.listDownloads;
    if (resolver) return resolver({ request, params });
    return missingResolver("listDownloads");
  }),
  http.get(`${baseUrl}/v1/admin/feature-flags`, async ({ request, params }) => {
    const resolver = resolvers.listFeatureFlags;
    if (resolver) return resolver({ request, params });
    return missingResolver("listFeatureFlags");
  }),
  http.get(`${baseUrl}/v1/operations/incidents`, async ({ request, params }) => {
    const resolver = resolvers.listIncidents;
    if (resolver) return resolver({ request, params });
    return missingResolver("listIncidents");
  }),
  http.get(`${baseUrl}/v1/ledger/entries`, async ({ request, params }) => {
    const resolver = resolvers.listLedgerEntries;
    if (resolver) return resolver({ request, params });
    return missingResolver("listLedgerEntries");
  }),
  http.get(`${baseUrl}/v1/admin/members`, async ({ request, params }) => {
    const resolver = resolvers.listMembers;
    if (resolver) return resolver({ request, params });
    return missingResolver("listMembers");
  }),
  http.get(`${baseUrl}/v1/orders`, async ({ request, params }) => {
    const resolver = resolvers.listOrders;
    if (resolver) return resolver({ request, params });
    return missingResolver("listOrders");
  }),
  http.get(`${baseUrl}/v1/admin/policies`, async ({ request, params }) => {
    const resolver = resolvers.listPolicies;
    if (resolver) return resolver({ request, params });
    return missingResolver("listPolicies");
  }),
  http.get(`${baseUrl}/v1/proposals`, async ({ request, params }) => {
    const resolver = resolvers.listProposals;
    if (resolver) return resolver({ request, params });
    return missingResolver("listProposals");
  }),
  http.get(`${baseUrl}/v1/reconciliation/breaks`, async ({ request, params }) => {
    const resolver = resolvers.listReconciliationBreaks;
    if (resolver) return resolver({ request, params });
    return missingResolver("listReconciliationBreaks");
  }),
  http.get(`${baseUrl}/v1/reconciliation/runs`, async ({ request, params }) => {
    const resolver = resolvers.listReconciliationRuns;
    if (resolver) return resolver({ request, params });
    return missingResolver("listReconciliationRuns");
  }),
  http.get(`${baseUrl}/v1/releases`, async ({ request, params }) => {
    const resolver = resolvers.listReleases;
    if (resolver) return resolver({ request, params });
    return missingResolver("listReleases");
  }),
  http.get(`${baseUrl}/v1/research-runs`, async ({ request, params }) => {
    const resolver = resolvers.listResearchRuns;
    if (resolver) return resolver({ request, params });
    return missingResolver("listResearchRuns");
  }),
  http.get(`${baseUrl}/v1/admin/roles`, async ({ request, params }) => {
    const resolver = resolvers.listRoles;
    if (resolver) return resolver({ request, params });
    return missingResolver("listRoles");
  }),
  http.get(`${baseUrl}/v1/operations/runbook-actions`, async ({ request, params }) => {
    const resolver = resolvers.listRunbookActions;
    if (resolver) return resolver({ request, params });
    return missingResolver("listRunbookActions");
  }),
  http.get(`${baseUrl}/v1/settings/sessions`, async ({ request, params }) => {
    const resolver = resolvers.listSessions;
    if (resolver) return resolver({ request, params });
    return missingResolver("listSessions");
  }),
  http.get(`${baseUrl}/v1/strategies`, async ({ request, params }) => {
    const resolver = resolvers.listStrategies;
    if (resolver) return resolver({ request, params });
    return missingResolver("listStrategies");
  }),
  http.post(`${baseUrl}/v1/auth/logout`, async ({ request, params }) => {
    const resolver = resolvers.logout;
    if (resolver) return resolver({ request, params });
    return missingResolver("logout");
  }),
  http.post(`${baseUrl}/v1/auth/mfa/challenges`, async ({ request, params }) => {
    const resolver = resolvers.mfaChallenge;
    if (resolver) return resolver({ request, params });
    return missingResolver("mfaChallenge");
  }),
  http.post(`${baseUrl}/v1/assisted-testnet/requests`, async ({ request, params }) => {
    const resolver = resolvers.openAssistedRequest;
    if (resolver) return resolver({ request, params });
    return missingResolver("openAssistedRequest");
  }),
  http.post(`${baseUrl}/v1/operations/incidents`, async ({ request, params }) => {
    const resolver = resolvers.openIncident;
    if (resolver) return resolver({ request, params });
    return missingResolver("openIncident");
  }),
  http.post(`${baseUrl}/v1/auth/reauth`, async ({ request, params }) => {
    const resolver = resolvers.reauth;
    if (resolver) return resolver({ request, params });
    return missingResolver("reauth");
  }),
  http.post(`${baseUrl}/v1/risk/kill-switch/release`, async ({ request, params }) => {
    const resolver = resolvers.releaseKillSwitch;
    if (resolver) return resolver({ request, params });
    return missingResolver("releaseKillSwitch");
  }),
  http.post(`${baseUrl}/v1/orders/:orderId/cancel-requests`, async ({ request, params }) => {
    const resolver = resolvers.requestOrderCancel;
    if (resolver) return resolver({ request, params });
    return missingResolver("requestOrderCancel");
  }),
  http.post(`${baseUrl}/v1/reconciliation/runs/:runId/reruns`, async ({ request, params }) => {
    const resolver = resolvers.requestReconciliationRerun;
    if (resolver) return resolver({ request, params });
    return missingResolver("requestReconciliationRerun");
  }),
  http.post(`${baseUrl}/v1/releases/:releaseId/rollback-requests`, async ({ request, params }) => {
    const resolver = resolvers.requestReleaseRollback;
    if (resolver) return resolver({ request, params });
    return missingResolver("requestReleaseRollback");
  }),
  http.post(`${baseUrl}/v1/proposals/:proposalId/risk-evaluations`, async ({ request, params }) => {
    const resolver = resolvers.requestRiskEvaluation;
    if (resolver) return resolver({ request, params });
    return missingResolver("requestRiskEvaluation");
  }),
  http.post(`${baseUrl}/v1/operations/incidents/:incidentId/resolve`, async ({ request, params }) => {
    const resolver = resolvers.resolveIncident;
    if (resolver) return resolver({ request, params });
    return missingResolver("resolveIncident");
  }),
  http.delete(`${baseUrl}/v1/settings/trusted-devices/:deviceId`, async ({ request, params }) => {
    const resolver = resolvers.revokeDevice;
    if (resolver) return resolver({ request, params });
    return missingResolver("revokeDevice");
  }),
  http.delete(`${baseUrl}/v1/settings/mfa/factors/:factorId`, async ({ request, params }) => {
    const resolver = resolvers.revokeMfaFactor;
    if (resolver) return resolver({ request, params });
    return missingResolver("revokeMfaFactor");
  }),
  http.delete(`${baseUrl}/v1/settings/sessions/:sessionId`, async ({ request, params }) => {
    const resolver = resolvers.revokeSession;
    if (resolver) return resolver({ request, params });
    return missingResolver("revokeSession");
  }),
  http.post(`${baseUrl}/v1/operations/runbook-actions/:actionId/runs`, async ({ request, params }) => {
    const resolver = resolvers.runApprovedRunbookAction;
    if (resolver) return resolver({ request, params });
    return missingResolver("runApprovedRunbookAction");
  }),
  http.post(`${baseUrl}/v1/strategies/:strategyId/static-checks`, async ({ request, params }) => {
    const resolver = resolvers.runStaticCheck;
    if (resolver) return resolver({ request, params });
    return missingResolver("runStaticCheck");
  }),
  http.put(`${baseUrl}/v1/alerts/subscriptions`, async ({ request, params }) => {
    const resolver = resolvers.saveAlertSubscriptions;
    if (resolver) return resolver({ request, params });
    return missingResolver("saveAlertSubscriptions");
  }),
  http.put(`${baseUrl}/v1/admin/capabilities/:resourceId`, async ({ request, params }) => {
    const resolver = resolvers.saveCapability;
    if (resolver) return resolver({ request, params });
    return missingResolver("saveCapability");
  }),
  http.put(`${baseUrl}/v1/admin/feature-flags/:resourceId`, async ({ request, params }) => {
    const resolver = resolvers.saveFeatureFlag;
    if (resolver) return resolver({ request, params });
    return missingResolver("saveFeatureFlag");
  }),
  http.put(`${baseUrl}/v1/settings/notification-preferences`, async ({ request, params }) => {
    const resolver = resolvers.saveNotificationPrefs;
    if (resolver) return resolver({ request, params });
    return missingResolver("saveNotificationPrefs");
  }),
  http.put(`${baseUrl}/v1/admin/policies/:resourceId`, async ({ request, params }) => {
    const resolver = resolvers.savePolicy;
    if (resolver) return resolver({ request, params });
    return missingResolver("savePolicy");
  }),
  http.put(`${baseUrl}/v1/settings/profile`, async ({ request, params }) => {
    const resolver = resolvers.saveProfile;
    if (resolver) return resolver({ request, params });
    return missingResolver("saveProfile");
  }),
  http.put(`${baseUrl}/v1/admin/roles/:resourceId`, async ({ request, params }) => {
    const resolver = resolvers.saveRole;
    if (resolver) return resolver({ request, params });
    return missingResolver("saveRole");
  }),
  http.put(`${baseUrl}/v1/strategies/:strategyId/draft`, async ({ request, params }) => {
    const resolver = resolvers.saveStrategyDraft;
    if (resolver) return resolver({ request, params });
    return missingResolver("saveStrategyDraft");
  }),
  http.put(`${baseUrl}/v1/markets/watchlist`, async ({ request, params }) => {
    const resolver = resolvers.saveWatchlist;
    if (resolver) return resolver({ request, params });
    return missingResolver("saveWatchlist");
  }),
  http.get(`${baseUrl}/v1/audit/events`, async ({ request, params }) => {
    const resolver = resolvers.searchAuditEvents;
    if (resolver) return resolver({ request, params });
    return missingResolver("searchAuditEvents");
  }),
  http.post(`${baseUrl}/v1/settings/mfa/setup`, async ({ request, params }) => {
    const resolver = resolvers.setupMfa;
    if (resolver) return resolver({ request, params });
    return missingResolver("setupMfa");
  }),
  http.post(`${baseUrl}/v1/access-requests`, async ({ request, params }) => {
    const resolver = resolvers.submitAccessRequest;
    if (resolver) return resolver({ request, params });
    return missingResolver("submitAccessRequest");
  }),
  http.post(`${baseUrl}/v1/assisted-testnet/requests/:requestId/commands`, async ({ request, params }) => {
    const resolver = resolvers.submitAssistedRequest;
    if (resolver) return resolver({ request, params });
    return missingResolver("submitAssistedRequest");
  }),
  http.post(`${baseUrl}/v1/releases/:releaseId/approval-submissions`, async ({ request, params }) => {
    const resolver = resolvers.submitReleaseApproval;
    if (resolver) return resolver({ request, params });
    return missingResolver("submitReleaseApproval");
  }),
  http.post(`${baseUrl}/v1/commands`, async ({ request, params }) => {
    const resolver = resolvers.submitTradeCommand;
    if (resolver) return resolver({ request, params });
    return missingResolver("submitTradeCommand");
  }),
  http.get(`${baseUrl}/v1/alerts/stream`, async ({ request, params }) => {
    const resolver = resolvers.subscribeAlerts;
    if (resolver) return resolver({ request, params });
    return missingResolver("subscribeAlerts");
  }),
  http.get(`${baseUrl}/v1/backtests/:runId/stream`, async ({ request, params }) => {
    const resolver = resolvers.subscribeBacktestRun;
    if (resolver) return resolver({ request, params });
    return missingResolver("subscribeBacktestRun");
  }),
  http.get(`${baseUrl}/v1/markets/candles/stream`, async ({ request, params }) => {
    const resolver = resolvers.subscribeCandles;
    if (resolver) return resolver({ request, params });
    return missingResolver("subscribeCandles");
  }),
  http.get(`${baseUrl}/v1/command/stream`, async ({ request, params }) => {
    const resolver = resolvers.subscribeCommandEvents;
    if (resolver) return resolver({ request, params });
    return missingResolver("subscribeCommandEvents");
  }),
  http.get(`${baseUrl}/v1/orders/:orderId/stream`, async ({ request, params }) => {
    const resolver = resolvers.subscribeOrder;
    if (resolver) return resolver({ request, params });
    return missingResolver("subscribeOrder");
  }),
  http.get(`${baseUrl}/v1/portfolio/stream`, async ({ request, params }) => {
    const resolver = resolvers.subscribePortfolio;
    if (resolver) return resolver({ request, params });
    return missingResolver("subscribePortfolio");
  }),
  http.get(`${baseUrl}/v1/proposals/:proposalId/stream`, async ({ request, params }) => {
    const resolver = resolvers.subscribeProposal;
    if (resolver) return resolver({ request, params });
    return missingResolver("subscribeProposal");
  }),
  http.get(`${baseUrl}/v1/markets/quotes/stream`, async ({ request, params }) => {
    const resolver = resolvers.subscribeQuotes;
    if (resolver) return resolver({ request, params });
    return missingResolver("subscribeQuotes");
  }),
  http.get(`${baseUrl}/v1/reconciliation/runs/:runId/stream`, async ({ request, params }) => {
    const resolver = resolvers.subscribeReconciliationRun;
    if (resolver) return resolver({ request, params });
    return missingResolver("subscribeReconciliationRun");
  }),
  http.get(`${baseUrl}/v1/research-runs/:runId/stream`, async ({ request, params }) => {
    const resolver = resolvers.subscribeResearchRun;
    if (resolver) return resolver({ request, params });
    return missingResolver("subscribeResearchRun");
  }),
  http.get(`${baseUrl}/v1/settings/sessions/stream`, async ({ request, params }) => {
    const resolver = resolvers.subscribeSessionRevocations;
    if (resolver) return resolver({ request, params });
    return missingResolver("subscribeSessionRevocations");
  }),
  http.get(`${baseUrl}/v1/trade-preflight/stream`, async ({ request, params }) => {
    const resolver = resolvers.subscribeTradePreflight;
    if (resolver) return resolver({ request, params });
    return missingResolver("subscribeTradePreflight");
  }),
  http.post(`${baseUrl}/v1/alerts/:alertId/unack`, async ({ request, params }) => {
    const resolver = resolvers.unackAlert;
    if (resolver) return resolver({ request, params });
    return missingResolver("unackAlert");
  }),
  http.put(`${baseUrl}/v1/admin/members/:resourceId`, async ({ request, params }) => {
    const resolver = resolvers.updateMember;
    if (resolver) return resolver({ request, params });
    return missingResolver("updateMember");
  }),
  ];
}
