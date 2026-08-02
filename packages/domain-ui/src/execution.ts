/**
 * P08–P11 execution page view models: Portfolio & Risk, Proposals,
 * Approvals, and Orders. Dangerous operations (kill switch, approval
 * decisions, cancels) always require DangerConfirm + short-lived MFA and only
 * reference server-issued objects — no direct venue calls exist here.
 */

import type {
  ApprovalDetail,
  OrderDetail,
  PortfolioView,
  ProposalDetail,
  RiskDecisionCard,
  RiskView,
} from "@sumalpha/api-client";

// ---------------------------------------------------------------------------
// P08 Portfolio & Risk
// ---------------------------------------------------------------------------

export interface PortfolioPageModel {
  accountId: string;
  asOfCopy: string;
  kpis: { label: string; value: string }[];
  positions: PortfolioView["positions"];
  executionBlocked: boolean;
  blockedReason: string | null;
}

export function buildPortfolioPage(view: PortfolioView): PortfolioPageModel {
  return {
    accountId: view.accountId,
    asOfCopy: `所有数值均以数据时间 ${view.asOf} 为准。`,
    kpis: [
      { label: "已实现 P&L", value: view.realizedPnl.toFixed(2) },
      { label: "未实现 P&L", value: view.unrealizedPnl.toFixed(2) },
      { label: "总敞口", value: view.exposureGross.toFixed(2) },
    ],
    positions: view.positions.map((position) => ({ ...position })),
    executionBlocked: view.stale,
    blockedReason: view.stale ? "数据陈旧，不能以此执行命令。" : null,
  };
}

export interface RiskPageModel {
  statusCopy: string;
  blockingEvents: RiskView["blockingEvents"];
  killSwitchEngaged: boolean;
  gauges: { label: string; value: string }[];
}

export function buildRiskPage(view: RiskView): RiskPageModel {
  return {
    statusCopy:
      view.blockingEvents.length === 0
        ? "未发现阻止新命令的风险事件。"
        : `存在 ${view.blockingEvents.length} 项阻止新命令的风险事件。`,
    blockingEvents: view.blockingEvents.map((event) => ({ ...event })),
    killSwitchEngaged: view.killSwitchEngaged,
    gauges: [
      { label: "杠杆", value: view.leverage.toFixed(2) },
      { label: "集中度", value: view.concentration.toFixed(2) },
    ],
  };
}

// ---------------------------------------------------------------------------
// Danger confirmation + MFA gate (kill switch, approvals, cancels)
// ---------------------------------------------------------------------------

export type DangerActionKind = "kill_switch" | "approve_decision" | "cancel_order";

export interface DangerConfirmState {
  action: DangerActionKind;
  confirmed: boolean;
  mfaToken: string | null;
}

export function beginDangerConfirm(action: DangerActionKind): DangerConfirmState {
  return { action, confirmed: false, mfaToken: null };
}

export function completeDangerConfirm(
  state: DangerConfirmState,
  mfaToken: string,
): DangerConfirmState {
  if (!mfaToken.startsWith("mfa-")) {
    throw new Error("高风险操作需要有效的 MFA 证明。");
  }
  return { ...state, confirmed: true, mfaToken };
}

export function dangerConfirmReady(state: DangerConfirmState): boolean {
  return state.confirmed && state.mfaToken !== null;
}

// ---------------------------------------------------------------------------
// P09 Proposals
// ---------------------------------------------------------------------------

export const PROPOSAL_COPY = {
  banner: "这是交易建议，不是订单。",
  hint: "建议不会直接提交到 venue。请先运行风险评估。",
  expired: "该建议已失效，不能进入风险评估。",
} as const;

export interface ProposalDetailModel {
  banner: string;
  hint: string;
  proposal: ProposalDetail;
  canRequestEvaluation: boolean;
  evaluationBlockReason: string | null;
  evidenceRoutes: string[];
}

export function buildProposalDetail(proposal: ProposalDetail, nowMs: number): ProposalDetailModel {
  const expired = proposal.status === "expired" || Date.parse(proposal.expiresAt) <= nowMs;
  return {
    banner: PROPOSAL_COPY.banner,
    hint: PROPOSAL_COPY.hint,
    proposal,
    canRequestEvaluation: !expired,
    evaluationBlockReason: expired ? PROPOSAL_COPY.expired : null,
    evidenceRoutes: proposal.evidence.map((entry) => `/artifacts/${entry.artifactId}`),
  };
}

// ---------------------------------------------------------------------------
// P10 Approvals
// ---------------------------------------------------------------------------

export const APPROVAL_COPY = {
  approveHint: "你正在批准一项受控交易动作。系统仍会在提交前执行最终校验。",
  rejectHint: "请说明拒绝理由。该理由将写入审计记录。",
} as const;

export interface ApprovalDetailModel {
  approval: ApprovalDetail;
  riskDecision: RiskDecisionCard;
  approveHint: string;
  rejectHint: string;
  selfApprovalBlocked: boolean;
  actionBarEnabled: boolean;
  actionBlockReason: string | null;
}

export function buildApprovalDetail(
  approval: ApprovalDetail,
  actor: string,
): ApprovalDetailModel {
  const selfApproval = approval.originator === actor;
  const pending = approval.status === "pending";
  return {
    approval,
    riskDecision: approval.riskDecision,
    approveHint: APPROVAL_COPY.approveHint,
    rejectHint: APPROVAL_COPY.rejectHint,
    selfApprovalBlocked: selfApproval,
    actionBarEnabled: pending && !selfApproval,
    actionBlockReason: selfApproval
      ? "不能审批本人发起的对象。"
      : pending
        ? null
        : `当前状态 ${approval.status} 不支持审批操作。`,
  };
}

// ---------------------------------------------------------------------------
// P11 Orders
// ---------------------------------------------------------------------------

export function orderModeBanner(mode: OrderDetail["mode"]): string {
  return mode === "paper"
    ? "PAPER · 此订单仅记录在模拟账本中。"
    : "SHADOW · 此结果用于对照，不会提交订单。";
}

export interface OrderDetailModel {
  order: OrderDetail;
  modeBanner: string;
  cancelSupported: boolean;
  cancelBlockReason: string | null;
  relatedRoutes: { label: string; route: string }[];
}

export function buildOrderDetail(order: OrderDetail): OrderDetailModel {
  const cancelSupported =
    order.venueHealthy &&
    (order.status === "submitted" ||
      order.status === "accepted" ||
      order.status === "partially_filled");
  return {
    order,
    modeBanner: orderModeBanner(order.mode),
    cancelSupported,
    cancelBlockReason: cancelSupported
      ? null
      : order.venueHealthy
        ? "当前状态不支持撤单。"
        : "venue 不健康，暂不支持撤单。",
    relatedRoutes: [
      { label: "Proposal", route: `/proposals/${order.proposalId}` },
      { label: "RiskDecision", route: `/approvals/${order.riskDecisionId}` },
      { label: "Release", route: `/releases/${order.releaseId}` },
      { label: "对账与审计", route: `/audit/corr-order-0001` },
    ],
  };
}
