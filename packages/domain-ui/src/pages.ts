/**
 * P01/P02/P05 page view models: auth states, command center aggregation, and
 * the data snapshot catalog/detail surfaces.
 */

import type {
  CommandCenterView,
  DataSnapshotSummary,
  TerminalSession,
} from "@sumalpha/api-client";

// ---------------------------------------------------------------------------
// P01 身份、访问与恢复
// ---------------------------------------------------------------------------

export type AuthFlowState =
  | { kind: "signed_out" }
  | { kind: "mfa_required"; challengeId: string }
  | { kind: "signed_in"; session: TerminalSession }
  | { kind: "session_expired"; returnRoute: string }
  | { kind: "access_pending"; requestId: string }
  | { kind: "unauthorized"; reason: string }
  | { kind: "offline" };

export const AUTH_COPY = {
  loginTitle: "进入 QuantOS Terminal",
  loginDescription: "使用你的组织账户继续。所有受控操作都会记录到审计轨迹。",
  accessRequestTitle: "申请访问 QuantOS Terminal",
  facts: ["安全", "审计", "Paper/Shadow"] as const,
};

export function resolveAuthState(
  session: TerminalSession | null,
  options: { networkOnline: boolean; mfaSatisfied?: boolean },
): AuthFlowState {
  if (!options.networkOnline) {
    return { kind: "offline" };
  }
  if (!session) {
    return { kind: "signed_out" };
  }
  if (!session.mfaSatisfied && options.mfaSatisfied !== true) {
    return { kind: "mfa_required", challengeId: `mfa-${session.actorId}` };
  }
  return { kind: "signed_in", session };
}

// ---------------------------------------------------------------------------
// P02 Command Center
// ---------------------------------------------------------------------------

export interface CommandCenterModel {
  modeBanner: string;
  kpis: { label: string; value: number; sampledAt: string }[];
  emptyQueueCopy: string;
}

export function buildCommandCenterModel(view: CommandCenterView): CommandCenterModel {
  return {
    modeBanner: view.modeBanner,
    kpis: [
      { label: "待审批", value: view.pendingApprovals, sampledAt: view.sampledAt },
      { label: "开放风险", value: view.openRiskAlerts, sampledAt: view.sampledAt },
      { label: "失败任务", value: view.failedRuns, sampledAt: view.sampledAt },
    ],
    emptyQueueCopy: "当前没有需要你处理的事项。",
  };
}

// ---------------------------------------------------------------------------
// P05 数据快照目录与详情
// ---------------------------------------------------------------------------

export interface SnapshotCardModel {
  snapshotId: string;
  contentHash: string;
  symbols: string[];
  qualityLabel: string;
  qualityCopy: string;
  licenseLabel: string;
  canUseForResearch: boolean;
  canUseForTrading: boolean;
}

export function buildSnapshotCard(snapshot: DataSnapshotSummary): SnapshotCardModel {
  const usable = snapshot.quality === "passed" || snapshot.quality === "degraded";
  return {
    snapshotId: snapshot.snapshotId,
    contentHash: snapshot.contentHash,
    symbols: [...snapshot.symbols],
    qualityLabel: snapshot.quality,
    qualityCopy: snapshot.usableForTrading
      ? "质量检查通过，可用于已授权工作流。"
      : "此快照存在质量限制，不能用于交易相关流程。",
    licenseLabel: snapshot.licenseLabel,
    canUseForResearch: usable,
    canUseForTrading: snapshot.usableForTrading,
  };
}

export function buildSnapshotCatalog(
  snapshots: DataSnapshotSummary[],
): SnapshotCardModel[] {
  return snapshots.map(buildSnapshotCard);
}
