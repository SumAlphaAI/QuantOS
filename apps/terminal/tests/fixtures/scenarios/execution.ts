/** Test-only UI scenario state. All public asynchronous reads pass the generated contract adapter. */
import type { PortfolioView, RiskView, ProposalRow, ProposalDetail, ApprovalRow, RiskDecisionCard, ApprovalDetail, OrderRow, OrderDetail} from "@sumalpha/api-client";
import { generatedScenario } from "./transport.js";
interface ExecutionBackend {
  getPortfolio(accountId: string): Promise<PortfolioView>;
  getRiskView(accountId: string): Promise<RiskView>;
  engageKillSwitch(scope: "global" | string, actor: string, mfaToken: string): Promise<RiskView>;
  listProposals(): Promise<ProposalRow[]>;
  getProposal(proposalId: string): Promise<ProposalDetail>;
  requestRiskEvaluation(proposalId: string): Promise<RiskDecisionCard>;
  listApprovals(): Promise<ApprovalRow[]>;
  getApproval(approvalId: string): Promise<ApprovalDetail>;
  decideApproval(
    approvalId: string,
    actor: string,
    decision: "approved" | "rejected",
    note: string,
    mfaToken: string,
  ): Promise<ApprovalDetail>;
  listOrders(): Promise<OrderRow[]>;
  getOrder(orderId: string): Promise<OrderDetail>;
  /** Cancel flows reference the server-issued command only. */
  requestOrderCancel(orderId: string, commandId: string): Promise<OrderDetail>;
}
const NOW = "2026-08-01T00:00:00Z";

class ScenarioExecutionState implements ExecutionBackend {
  private killSwitch = false;
  private readonly proposal: ProposalDetail = {
    proposalId: "proposal-0001",
    symbol: "BTCUSDT",
    side: "buy",
    status: "evaluated",
    expiresAt: "2026-08-01T00:10:00Z",
    signalId: "signal-0001",
    counterViews: ["momentum overheated on 4h"],
    evidenceCount: 2,
    summary: "Bull breakout committee proposal",
    accountId: "paper-account-0",
    notional: 25_000,
    dataSnapshotId: "snapshot-btc-2026-07-31",
    strategyReleaseId: "release-0001",
    evidence: [
      { evidenceId: "evidence-1", artifactId: "artifact-signal-1", summary: "supporting signal" },
      { evidenceId: "evidence-2", artifactId: "artifact-committee-1", summary: "committee view" },
    ],
  };

  private readonly riskDecision: RiskDecisionCard = {
    decisionId: "decision-0001",
    verdict: "approval_required",
    hitRules: [
      { ruleId: "approval_required", detail: "notional above approval threshold", limitId: "limit.approval_threshold" },
    ],
    signer: "quantos-risk.v1",
    signature: "sha256:decision-0001",
    decidedAt: NOW,
  };

  private approvals = new Map<string, ApprovalDetail>();
  private orders = new Map<string, OrderDetail>();

  constructor() {
    this.approvals.set("approval-0001", {
      approvalId: "approval-0001",
      proposalId: this.proposal.proposalId,
      severity: "warning",
      status: "pending",
      expiresAt: "2026-08-01T00:15:00Z",
      proposal: this.proposal,
      riskDecision: this.riskDecision,
      originator: "quant-researcher",
      commandId: null,
    });
    this.orders.set("order-0001", {
      orderId: "order-0001",
      commandId: "command-0001",
      mode: "paper",
      symbol: "BTCUSDT",
      side: "buy",
      status: "filled",
      filledQuantity: 2,
      averageFillPrice: 100.25,
      submittedAt: NOW,
      accountId: "paper-account-0",
      idempotencyKey: "cmd-000001",
      proposalId: this.proposal.proposalId,
      riskDecisionId: this.riskDecision.decisionId,
      releaseId: "release-0001",
      venueHealthy: true,
      timeline: [
        { sequence: 1, kind: "submitted", at: NOW },
        { sequence: 2, kind: "accepted", at: NOW },
        { sequence: 3, kind: "filled", at: NOW },
      ],
      fills: [{ fillId: "fill-0001", quantity: 2, price: 100.25, fee: 0.5, at: NOW }],
    });
  }

  async getPortfolio(accountId: string): Promise<PortfolioView> {
    return {
      accountId,
      asOf: NOW,
      realizedPnl: -0.5,
      unrealizedPnl: 19.5,
      exposureGross: 200.5,
      exposureNet: 220.0,
      positions: [
        {
          symbol: "BTCUSDT",
          quantity: 2,
          averageEntryPrice: 100.25,
          markPrice: 110.0,
          marketValue: 220.0,
          unrealizedPnl: 19.5,
          realizedPnl: -0.5,
        },
      ],
      stale: false,
    };
  }

  async getRiskView(accountId: string): Promise<RiskView> {
    void accountId;
    return {
      asOf: NOW,
      blockingEvents: this.killSwitch
        ? [
            {
              eventId: "risk-event-kill",
              ruleId: "kill_switch_global",
              severity: "critical",
              detail: "global kill switch engaged",
              occurredAt: NOW,
              proposalId: null,
              orderId: null,
            },
          ]
        : [],
      recentEvents: [
        {
          eventId: "risk-event-1",
          ruleId: "approval_required",
          severity: "warning",
          detail: "notional above approval threshold",
          occurredAt: NOW,
          proposalId: this.proposal.proposalId,
          orderId: "order-0001",
        },
      ],
      killSwitchEngaged: this.killSwitch,
      leverage: 1.2,
      concentration: 0.35,
    };
  }

  async engageKillSwitch(scope: "global" | string, _actor: string, mfaToken: string) {
    if (!mfaToken.startsWith("mfa-")) {
      throw new Error("kill switch requires a valid MFA token");
    }
    if (scope === "global") {
      this.killSwitch = true;
    }
    return this.getRiskView(scope === "global" ? "paper-account-0" : scope);
  }

  async listProposals(): Promise<ProposalRow[]> {
    return [{ ...this.proposal }];
  }

  async getProposal(proposalId: string): Promise<ProposalDetail> {
    if (proposalId !== this.proposal.proposalId) {
      throw new Error(`proposal ${proposalId} not found`);
    }
    return { ...this.proposal, evidence: this.proposal.evidence.map((e) => ({ ...e })) };
  }

  async requestRiskEvaluation(proposalId: string): Promise<RiskDecisionCard> {
    const proposal = await this.getProposal(proposalId);
    if (proposal.status === "expired") {
      throw new Error("expired proposals cannot enter risk evaluation");
    }
    return { ...this.riskDecision, hitRules: this.riskDecision.hitRules.map((h) => ({ ...h })) };
  }

  async listApprovals(): Promise<ApprovalRow[]> {
    return [...this.approvals.values()].map((approval) => ({ ...approval }));
  }

  async getApproval(approvalId: string): Promise<ApprovalDetail> {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      throw new Error(`approval ${approvalId} not found`);
    }
    return approval;
  }

  async decideApproval(
    approvalId: string,
    actor: string,
    decision: "approved" | "rejected",
    note: string,
    mfaToken: string,
  ): Promise<ApprovalDetail> {
    const approval = this.approvals.get(approvalId);
    if (!approval) {
      throw new Error(`approval ${approvalId} not found`);
    }
    if (approval.originator === actor) {
      throw new Error("self approval is forbidden");
    }
    if (!mfaToken.startsWith("mfa-")) {
      throw new Error("approval decisions require a valid MFA token");
    }
    if (approval.status !== "pending") {
      throw new Error(`approval ${approvalId} is not pending`);
    }
    if (decision === "rejected" && note.trim().length === 0) {
      throw new Error("rejection requires an audit-recorded reason");
    }
    approval.status = decision;
    if (decision === "approved") {
      approval.commandId = "command-0001";
    }
    this.approvals.set(approvalId, approval);
    return approval;
  }

  async listOrders(): Promise<OrderRow[]> {
    return [...this.orders.values()].map((order) => ({ ...order }));
  }

  async getOrder(orderId: string): Promise<OrderDetail> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`order ${orderId} not found`);
    }
    return {
      ...order,
      timeline: order.timeline.map((event) => ({ ...event })),
      fills: order.fills.map((fill) => ({ ...fill })),
    };
  }

  async requestOrderCancel(orderId: string, commandId: string): Promise<OrderDetail> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`order ${orderId} not found`);
    }
    if (order.commandId !== commandId) {
      throw new Error("cancel requires the server-issued command reference");
    }
    if (order.status !== "submitted" && order.status !== "accepted" && order.status !== "partially_filled") {
      throw new Error("当前状态不支持撤单。");
    }
    order.status = "cancelled";
    const nextSequence = (order.timeline.at(-1)?.sequence ?? 0) + 1;
    order.timeline.push({ sequence: nextSequence, kind: "cancelled", at: NOW });
    this.orders.set(orderId, order);
    return this.getOrder(orderId);
  }
}

export function createExecutionScenario() { return generatedScenario("execution", new ScenarioExecutionState()); }
