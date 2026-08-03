/**
 * P06/P07 Strategy page view models: catalog, Strategy Lab, backtest detail,
 * immutable releases, approval timelines, and capability-driven deployment
 * target selection. Deployment targets always come from the BFF payload and
 * are never derived in the frontend.
 */

import type {
  BacktestReport,
  DeploymentTargetOption,
  StaticCheckResult,
  StrategyDraftDetail,
  StrategyReleaseView,
  StrategySummary,
} from "@sumalpha/api-client";

// ---------------------------------------------------------------------------
// P06 Strategy catalog + Strategy Lab
// ---------------------------------------------------------------------------

export interface StrategyCardModel {
  strategyId: string;
  name: string;
  statusLabel: string;
  draftVersion: number;
  labRoute: string;
}

export function buildStrategyCatalog(summaries: StrategySummary[]): StrategyCardModel[] {
  return summaries.map((summary) => ({
    strategyId: summary.strategyId,
    name: summary.name,
    statusLabel: summary.status,
    draftVersion: summary.draftVersion,
    labRoute: `/strategies/${summary.strategyId}/lab`,
  }));
}

export const LAB_COPY = {
  title: "Strategy Lab",
  hint: "策略草稿不能直接交易。请完成验证、回测和审批。",
  empty: "尚未创建策略。你可以从研究证据开始。",
} as const;

export type LabActionKind = "run_static_check" | "create_backtest" | "submit_release";

export interface LabActionState {
  action: LabActionKind;
  enabled: boolean;
  reason: string | null;
}

/**
 * Lab actions are gated by validation state: static check first, backtest
 * second, release candidate only after both pass with zero leak violations.
 */
export function labActions(
  draft: StrategyDraftDetail,
  backtest: BacktestReport | null,
  editable: boolean,
): LabActionState[] {
  const staticPassed = draft.staticCheck?.passed === true;
  const backtestClean = backtest !== null && backtest.leakCheckViolations === 0;
  const gate = (enabled: boolean, reason: string | null): { enabled: boolean; reason: string | null } => ({
    enabled: editable && enabled,
    reason: editable ? reason : "当前角色只读。",
  });
  return [
    { action: "run_static_check", ...gate(true, null) },
    {
      action: "create_backtest",
      ...gate(staticPassed, staticPassed ? null : "静态检查通过后才能创建回测。"),
    },
    {
      action: "submit_release",
      ...gate(
        staticPassed && backtestClean,
        staticPassed && backtestClean ? null : "需要静态检查通过且无违规的回测报告。",
      ),
    },
  ];
}

export interface ValidationPanelModel {
  staticCheck: StaticCheckResult | null;
  blockers: string[];
}

export function buildValidationPanel(
  draft: StrategyDraftDetail,
  backtest: BacktestReport | null,
): ValidationPanelModel {
  const blockers: string[] = [];
  if (!draft.staticCheck?.passed) {
    blockers.push("静态检查未通过");
  }
  if (!backtest) {
    blockers.push("缺少回测报告");
  } else if (backtest.leakCheckViolations > 0) {
    blockers.push("回测存在 look-ahead 或数据泄漏违规");
  }
  if (!draft.dataSnapshotId) {
    blockers.push("缺少数据快照");
  }
  return { staticCheck: draft.staticCheck, blockers };
}

// ---------------------------------------------------------------------------
// P07 Backtest detail + Strategy Release
// ---------------------------------------------------------------------------

export const BACKTEST_COPY = {
  hint: "回测结果不等于可部署策略。",
  releaseButton: "创建不可变发布物",
  deploymentHint: "M3/M4 仅允许 Paper 或 Shadow。",
} as const;

export interface BacktestDetailModel {
  runId: string;
  inputHash: string;
  environmentHash: string;
  reportHash: string;
  metrics: { label: string; value: string }[];
  costs: { feesTotal: number; slippageTotal: number };
  leakCheckClean: boolean;
}

export function buildBacktestDetail(report: BacktestReport): BacktestDetailModel {
  return {
    runId: report.runId,
    inputHash: report.inputHash,
    environmentHash: report.environmentHash,
    reportHash: report.reportHash,
    metrics: [
      { label: "总收益", value: report.totalReturn.toFixed(4) },
      { label: "最大回撤", value: report.maxDrawdown.toFixed(4) },
      { label: "Sharpe", value: report.sharpe.toFixed(2) },
      { label: "成交笔数", value: String(report.tradeCount) },
    ],
    costs: { feesTotal: report.feesTotal, slippageTotal: report.slippageTotal },
    leakCheckClean: report.leakCheckViolations === 0,
  };
}

export interface ApprovalTimelineModel {
  state: StrategyReleaseView["approvalState"];
  stateLabel: string;
  entries: { actor: string; actionLabel: string; at: string; note: string }[];
  deployable: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  submitted: "已提交",
  approved: "审批通过",
  rejected: "审批拒绝",
  expired: "已过期",
  conflict_detected: "并发冲突",
};

const STATE_LABELS: Record<StrategyReleaseView["approvalState"], string> = {
  pending: "待审批",
  approved: "已通过",
  rejected: "已拒绝",
  expired: "已过期",
  conflict: "并发冲突",
};

export function buildApprovalTimeline(release: StrategyReleaseView): ApprovalTimelineModel {
  return {
    state: release.approvalState,
    stateLabel: STATE_LABELS[release.approvalState],
    entries: release.timeline.map((entry) => ({
      actor: entry.actor,
      actionLabel: ACTION_LABELS[entry.action] ?? entry.action,
      at: entry.at,
      note: entry.note,
    })),
    deployable: release.approvalState === "approved",
  };
}

export interface DeploymentTargetSelectorModel {
  hint: string;
  options: DeploymentTargetOption[];
  /** Targets the user may actually pick (enabled by capability/mode from BFF). */
  selectableTargets: string[];
}

export function buildDeploymentTargetSelector(
  release: StrategyReleaseView,
): DeploymentTargetSelectorModel {
  return {
    hint: BACKTEST_COPY.deploymentHint,
    options: release.allowedTargets.map((option) => ({ ...option })),
    selectableTargets: release.allowedTargets
      .filter((option) => option.enabled)
      .map((option) => option.target),
  };
}

// ---------------------------------------------------------------------------
// Capability-driven visibility for approval actions
// ---------------------------------------------------------------------------

export interface ApprovalActionVisibility {
  canApprove: boolean;
  canReject: boolean;
}

// ---------------------------------------------------------------------------
// M5 Assisted Live UI gate (P10/P11): reachable only when the server-side
// feature flag says so; the UI never infers it from anything else.
// ---------------------------------------------------------------------------

export interface AssistedLiveGateModel {
  reachable: boolean;
  banner: string | null;
  /** Deployment targets the UI may render inside the gate. */
  visibleTargets: string[];
}

export function assistedLiveGate(
  testnetFlagEnabled: boolean,
  options: DeploymentTargetOption[],
): AssistedLiveGateModel {
  if (!testnetFlagEnabled) {
    return {
      reachable: false,
      banner: "Assisted Live 尚未开放。需完成 M5 Gate 并获得单独批准。",
      visibleTargets: options
        .filter((option) => option.enabled && option.target !== "assisted_live")
        .map((option) => option.target),
    };
  }
  return {
    reachable: true,
    banner: "Assisted Live（testnet）已开放，需双人审批与 MFA。",
    visibleTargets: options.filter((option) => option.enabled).map((option) => option.target),
  };
}

export function approvalActionVisibility(
  capabilities: readonly string[],
  approvalState: StrategyReleaseView["approvalState"],
): ApprovalActionVisibility {
  const hasApprovalCapability = capabilities.includes("strategy.approve");
  const pending = approvalState === "pending";
  return {
    canApprove: hasApprovalCapability && pending,
    canReject: hasApprovalCapability && pending,
  };
}
