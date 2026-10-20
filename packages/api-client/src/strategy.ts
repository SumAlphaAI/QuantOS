/**
 * Strategy domain typed client: catalog, Lab drafts, backtest reports,
 * immutable releases, approval timelines, and capability-driven deployment
 * targets. Deployment targets are always returned by the BFF (derived from
 * capability/mode) and are never hard-coded in the frontend.
 */

export type StrategyDraftStatus = "draft" | "checked" | "backtested" | "release_candidate";

export interface StrategySummary {
  strategyId: string;
  name: string;
  status: StrategyDraftStatus;
  draftVersion: number;
  updatedAt: string;
}

export interface StaticCheckResult {
  passed: boolean;
  findings: string[];
}

export interface StrategyDraftDetail {
  strategyId: string;
  name: string;
  draftVersion: number;
  rule: string;
  parameters: Record<string, number | string>;
  staticCheck: StaticCheckResult | null;
  backtestRunId: string | null;
  dataSnapshotId: string;
  evidenceRefs: string[];
}

export interface BacktestReport {
  runId: string;
  strategyId: string;
  inputHash: string;
  environmentHash: string;
  reportHash: string;
  totalReturn: number;
  maxDrawdown: number;
  sharpe: number;
  tradeCount: number;
  feesTotal: number;
  slippageTotal: number;
  leakCheckViolations: number;
  generatedAt: string;
}

export type ApprovalDecisionKind = "approved" | "rejected";
export type ReleaseApprovalState =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "conflict";

export interface ApprovalTimelineEntry {
  entryId: string;
  actor: string;
  action: "submitted" | "approved" | "rejected" | "expired" | "conflict_detected";
  at: string;
  note: string;
}

export type DeploymentTargetKind = "paper" | "shadow" | "assisted_live";

export interface DeploymentTargetOption {
  target: DeploymentTargetKind;
  enabled: boolean;
  /** Explains locked options, e.g. the M5 gate for Assisted Live. */
  reason: string | null;
}

export interface StrategyReleaseView {
  releaseId: string;
  strategyId: string;
  name: string;
  contentHash: string;
  backtestReportHash: string;
  approvalState: ReleaseApprovalState;
  allowedTargets: DeploymentTargetOption[];
  timeline: ApprovalTimelineEntry[];
  createdAt: string;
}
