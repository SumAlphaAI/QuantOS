/* eslint-disable */
// Generated from bff/openapi/quantos-bff.v1.yaml (1.3.0). Do not edit.
import { http, HttpResponse, type PathParams } from "msw";

export interface BffMockResolverContext {
  request: Request;
  params: PathParams;
}

export type BffMockResolver = (context: BffMockResolverContext) => Response | Promise<Response>;
export type BffMockResolvers = Partial<Record<BffOperationId, BffMockResolver>>;

export type BffOperationId =
  | "cancelExport"
  | "cancelResearchRun"
  | "createBacktest"
  | "createExport"
  | "createRelease"
  | "createResearchRun"
  | "decideApproval"
  | "engageKillSwitch"
  | "getApproval"
  | "getArtifact"
  | "getBacktest"
  | "getContext"
  | "getDataSnapshot"
  | "getEvidenceChain"
  | "getExportDownload"
  | "getExportStatus"
  | "getNotificationPrefs"
  | "getOrder"
  | "getPlatformCapabilities"
  | "getPortfolio"
  | "getProfile"
  | "getProposal"
  | "getRelease"
  | "getResearchRun"
  | "getRiskView"
  | "getSecuritySettings"
  | "getSession"
  | "getStrategyDraft"
  | "listApprovals"
  | "listDataSnapshots"
  | "listDevices"
  | "listDownloads"
  | "listOrders"
  | "listProposals"
  | "listReleases"
  | "listResearchRuns"
  | "listSessions"
  | "listStrategies"
  | "logout"
  | "mfaChallenge"
  | "reauth"
  | "releaseKillSwitch"
  | "requestOrderCancel"
  | "requestReleaseRollback"
  | "requestRiskEvaluation"
  | "revokeDevice"
  | "revokeMfaFactor"
  | "revokeSession"
  | "runStaticCheck"
  | "saveNotificationPrefs"
  | "saveProfile"
  | "saveStrategyDraft"
  | "searchAuditEvents"
  | "setupMfa"
  | "submitAccessRequest"
  | "submitReleaseApproval"
  | "submitTradeCommand"
  | "subscribeOrder"
  | "subscribePortfolio"
  | "subscribeProposal"
  | "subscribeResearchRun"
  | "subscribeSessionRevocations";

function missingResolver(operationId: BffOperationId): Response {
  return HttpResponse.json(
    { code: "MOCK_NOT_CONFIGURED", message: `No fixture configured for ${operationId}.`, correlationId: "00000000-0000-4000-8000-000000000000" },
    { status: 501 },
  );
}

export function createGeneratedBffHandlers(
  resolvers: BffMockResolvers,
  baseUrl = "http://localhost:4010",
) {
  return [
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
  http.post(`${baseUrl}/v1/backtests`, async ({ request, params }) => {
    const resolver = resolvers.createBacktest;
    if (resolver) return resolver({ request, params });
    return missingResolver("createBacktest");
  }),
  http.post(`${baseUrl}/v1/exports`, async ({ request, params }) => {
    const resolver = resolvers.createExport;
    if (resolver) return resolver({ request, params });
    return missingResolver("createExport");
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
  http.post(`${baseUrl}/v1/approvals/:approvalId/decisions`, async ({ request, params }) => {
    const resolver = resolvers.decideApproval;
    if (resolver) return resolver({ request, params });
    return missingResolver("decideApproval");
  }),
  http.post(`${baseUrl}/v1/risk/kill-switch/engage`, async ({ request, params }) => {
    const resolver = resolvers.engageKillSwitch;
    if (resolver) return resolver({ request, params });
    return missingResolver("engageKillSwitch");
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
  http.get(`${baseUrl}/v1/backtests/:runId`, async ({ request, params }) => {
    const resolver = resolvers.getBacktest;
    if (resolver) return resolver({ request, params });
    return missingResolver("getBacktest");
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
  http.get(`${baseUrl}/v1/platform/browser-capabilities`, async ({ request, params }) => {
    const resolver = resolvers.getPlatformCapabilities;
    if (resolver) return resolver({ request, params });
    return missingResolver("getPlatformCapabilities");
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
  http.get(`${baseUrl}/v1/releases/:releaseId`, async ({ request, params }) => {
    const resolver = resolvers.getRelease;
    if (resolver) return resolver({ request, params });
    return missingResolver("getRelease");
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
  http.get(`${baseUrl}/v1/settings/security`, async ({ request, params }) => {
    const resolver = resolvers.getSecuritySettings;
    if (resolver) return resolver({ request, params });
    return missingResolver("getSecuritySettings");
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
  http.get(`${baseUrl}/v1/approvals`, async ({ request, params }) => {
    const resolver = resolvers.listApprovals;
    if (resolver) return resolver({ request, params });
    return missingResolver("listApprovals");
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
  http.get(`${baseUrl}/v1/orders`, async ({ request, params }) => {
    const resolver = resolvers.listOrders;
    if (resolver) return resolver({ request, params });
    return missingResolver("listOrders");
  }),
  http.get(`${baseUrl}/v1/proposals`, async ({ request, params }) => {
    const resolver = resolvers.listProposals;
    if (resolver) return resolver({ request, params });
    return missingResolver("listProposals");
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
  http.post(`${baseUrl}/v1/strategies/:strategyId/static-checks`, async ({ request, params }) => {
    const resolver = resolvers.runStaticCheck;
    if (resolver) return resolver({ request, params });
    return missingResolver("runStaticCheck");
  }),
  http.put(`${baseUrl}/v1/settings/notification-preferences`, async ({ request, params }) => {
    const resolver = resolvers.saveNotificationPrefs;
    if (resolver) return resolver({ request, params });
    return missingResolver("saveNotificationPrefs");
  }),
  http.put(`${baseUrl}/v1/settings/profile`, async ({ request, params }) => {
    const resolver = resolvers.saveProfile;
    if (resolver) return resolver({ request, params });
    return missingResolver("saveProfile");
  }),
  http.put(`${baseUrl}/v1/strategies/:strategyId/draft`, async ({ request, params }) => {
    const resolver = resolvers.saveStrategyDraft;
    if (resolver) return resolver({ request, params });
    return missingResolver("saveStrategyDraft");
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
  ];
}
