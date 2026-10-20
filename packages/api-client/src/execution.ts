/**
 * Execution domain typed client (P08–P11): portfolio/risk read models,
 * proposals, approvals, and orders. Every surface speaks only in server-side
 * references — no page can issue a direct venue request through this client.
 */

export interface PortfolioPositionRow {
  symbol: string;
  quantity: number;
  averageEntryPrice: number;
  markPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

export interface PortfolioView {
  accountId: string;
  asOf: string;
  realizedPnl: number;
  unrealizedPnl: number;
  exposureGross: number;
  exposureNet: number;
  positions: PortfolioPositionRow[];
  /** True when the read model lags; command execution must be blocked. */
  stale: boolean;
}

export type RiskRuleSeverity = "info" | "warning" | "critical";

export interface RiskEventRow {
  eventId: string;
  ruleId: string;
  severity: RiskRuleSeverity;
  detail: string;
  occurredAt: string;
  proposalId: string | null;
  orderId: string | null;
}

export interface RiskView {
  asOf: string;
  blockingEvents: RiskEventRow[];
  recentEvents: RiskEventRow[];
  killSwitchEngaged: boolean;
  leverage: number;
  concentration: number;
}

export interface ProposalRow {
  proposalId: string;
  symbol: string;
  side: string;
  status: "active" | "expired" | "evaluated";
  expiresAt: string;
  signalId: string;
  counterViews: string[];
  evidenceCount: number;
}

export interface ProposalDetail extends ProposalRow {
  summary: string;
  accountId: string;
  notional: number;
  dataSnapshotId: string;
  strategyReleaseId: string;
  evidence: { evidenceId: string; artifactId: string; summary: string }[];
}

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "conflict";

export interface ApprovalRow {
  approvalId: string;
  proposalId: string;
  severity: RiskRuleSeverity;
  status: ApprovalStatus;
  expiresAt: string;
}

export interface RiskDecisionCard {
  decisionId: string;
  verdict: "allow" | "deny" | "approval_required";
  hitRules: { ruleId: string; detail: string; limitId: string | null }[];
  signer: string;
  signature: string;
  decidedAt: string;
}

export interface ApprovalDetail extends ApprovalRow {
  proposal: ProposalDetail;
  riskDecision: RiskDecisionCard;
  originator: string;
  commandId: string | null;
}

export type OrderLifecycleStatus =
  | "submitted"
  | "accepted"
  | "partially_filled"
  | "filled"
  | "cancelled"
  | "rejected"
  | "expired";

export interface OrderRow {
  orderId: string;
  commandId: string;
  mode: "paper" | "shadow";
  symbol: string;
  side: string;
  status: OrderLifecycleStatus;
  filledQuantity: number;
  averageFillPrice: number | null;
  submittedAt: string;
}

export interface OrderTimelineEvent {
  sequence: number;
  kind: string;
  at: string;
}

export interface OrderDetail extends OrderRow {
  accountId: string;
  idempotencyKey: string;
  proposalId: string;
  riskDecisionId: string;
  releaseId: string;
  venueHealthy: boolean;
  timeline: OrderTimelineEvent[];
  fills: { fillId: string; quantity: number; price: number; fee: number; at: string }[];
}
