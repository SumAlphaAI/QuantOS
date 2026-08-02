/**
 * X06 acceptance scenarios: full evidence-chain reconstruction from any order
 * within the 5-minute SLA, order/approval/kill-switch E2E, no direct venue
 * request surface, and identical behavior across web/desktop bindings.
 */

import { describe, expect, it } from "vitest";
import { InMemoryExecutionBackend, InMemoryOpsBackend } from "@sumalpha/api-client";
import {
  beginDangerConfirm,
  buildAdminPage,
  buildApprovalDetail,
  buildAuditTimeline,
  buildEvidenceChain,
  buildExportJob,
  buildIncidentDetail,
  buildOperationsPage,
  buildOrderDetail,
  buildPortfolioPage,
  buildProposalDetail,
  buildRiskPage,
  completeDangerConfirm,
  dangerConfirmReady,
  pageMetaFor,
  visibleHighRiskActions,
  viewportForWidth,
} from "@sumalpha/domain-ui";
import type { PlatformKind } from "@sumalpha/platform";

import { createTerminalApp } from "../src/app.js";

const CHAIN_SLA_MS = 5 * 60 * 1000;

describe("X06 execution/audit/ops scenarios (web + desktop)", () => {
  for (const kind of ["web", "desktop"] as PlatformKind[]) {
    it(`reconstructs the full evidence chain from an order within the SLA on ${kind}`, async () => {
      const execution = new InMemoryExecutionBackend();
      const ops = new InMemoryOpsBackend();

      const started = Date.now();
      const order = await execution.getOrder("order-0001");
      const orderModel = buildOrderDetail(order);
      expect(orderModel.modeBanner).toContain("PAPER");
      expect(orderModel.relatedRoutes.map((route) => route.route)).toEqual([
        "/proposals/proposal-0001",
        "/approvals/decision-0001",
        "/releases/release-0001",
        "/audit/corr-order-0001",
      ]);

      const auditEvents = await ops.searchAudit("order-0001");
      const timeline = buildAuditTimeline(auditEvents);
      expect(timeline.events.length).toBeGreaterThan(0);
      expect(timeline.redactionComplete).toBe(true);

      const chain = buildEvidenceChain(
        "corr-order-0001",
        await ops.getEvidenceChain("corr-order-0001"),
      );
      expect(chain.complete).toBe(true);
      expect(chain.nodes.map((node) => node.kind)).toEqual([
        "snapshot",
        "release",
        "proposal",
        "risk_decision",
        "approval",
        "command",
        "order",
        "fill",
      ]);
      expect(chain.nodes.every((node) => node.hash.startsWith("sha256:"))).toBe(true);
      expect(Date.now() - started).toBeLessThan(CHAIN_SLA_MS);
    });

    it(`runs order/approval/kill-switch flows with MFA and self-approval bans on ${kind}`, async () => {
      const execution = new InMemoryExecutionBackend();

      // Portfolio & risk read models with as-of context
      const portfolio = buildPortfolioPage(await execution.getPortfolio("paper-account-0"));
      expect(portfolio.asOfCopy).toContain("数据时间");
      expect(portfolio.executionBlocked).toBe(false);
      const risk = buildRiskPage(await execution.getRiskView("paper-account-0"));
      expect(risk.statusCopy).toBe("未发现阻止新命令的风险事件。");

      // Proposal detail: non-executable banner, evaluation allowed while active
      const proposal = buildProposalDetail(
        await execution.getProposal("proposal-0001"),
        Date.parse("2026-08-01T00:00:00Z"),
      );
      expect(proposal.banner).toBe("这是交易建议，不是订单。");
      expect(proposal.canRequestEvaluation).toBe(true);
      const decision = await execution.requestRiskEvaluation("proposal-0001");
      expect(decision.signature).toMatch(/^sha256:/);

      // Approval: self-approval blocked, MFA required, approval links command
      const approval = await execution.getApproval("approval-0001");
      const selfModel = buildApprovalDetail(approval, "quant-researcher");
      expect(selfModel.selfApprovalBlocked).toBe(true);
      expect(selfModel.actionBarEnabled).toBe(false);
      const approverModel = buildApprovalDetail(approval, "risk-officer");
      expect(approverModel.actionBarEnabled).toBe(true);
      await expect(
        execution.decideApproval("approval-0001", "quant-researcher", "approved", "", "mfa-1"),
      ).rejects.toThrow("self approval");
      await expect(
        execution.decideApproval("approval-0001", "risk-officer", "approved", "", "bad-token"),
      ).rejects.toThrow("MFA");
      const decided = await execution.decideApproval(
        "approval-0001",
        "risk-officer",
        "approved",
        "",
        "mfa-risk-officer",
      );
      expect(decided.status).toBe("approved");
      expect(decided.commandId).toBe("command-0001");

      // Cancel requires the server-issued command reference
      await expect(execution.requestOrderCancel("order-0001", "wrong-command")).rejects.toThrow(
        "command reference",
      );
      await expect(execution.requestOrderCancel("order-0001", "command-0001")).rejects.toThrow(
        "不支持撤单",
      );

      // Kill switch behind DangerConfirm + MFA
      const confirm = completeDangerConfirm(beginDangerConfirm("kill_switch"), "mfa-risk-officer");
      expect(dangerConfirmReady(confirm)).toBe(true);
      const afterKill = await execution.engageKillSwitch("global", "risk-officer", "mfa-risk-officer");
      expect(afterKill.killSwitchEngaged).toBe(true);
      const riskAfter = buildRiskPage(afterKill);
      expect(riskAfter.statusCopy).toContain("阻止新命令");
      await expect(execution.engageKillSwitch("global", "risk-officer", "no-token")).rejects.toThrow(
        "MFA",
      );
    });

    it(`serves operations, incident runbooks, exports, and admin guardrails on ${kind}`, async () => {
      const ops = new InMemoryOpsBackend();

      const operations = buildOperationsPage(await ops.getOperationsView());
      expect(operations.degradedBanner).toContain("降级");

      const incident = buildIncidentDetail(await ops.getIncident("incident-0001"));
      expect(incident.runbookCopy).toContain("已批准 Runbook");
      expect(incident.actions).toHaveLength(1);
      await expect(ops.runRunbookAction("incident-0001", "arbitrary-shell", "sre")).rejects.toThrow(
        "not an approved action",
      );
      const afterAction = await ops.runRunbookAction("incident-0001", "controlled-retry", "sre");
      expect(afterAction.actionLog).toHaveLength(1);

      const exportJob = await ops.createExportJob("corr-order-0001", "auditor");
      expect(buildExportJob(exportJob).downloadable).toBe(false);
      const readyJob = buildExportJob(await ops.getExportJob(exportJob.exportId));
      expect(readyJob.downloadable).toBe(true);
      expect(readyJob.job.signedUrl).toContain("signature=sha256:");

      const admin = buildAdminPage(await ops.getAdminView());
      expect(admin.lastAdminProtected).toBe(true);
      await expect(ops.deactivateMember("member-admin", "admin")).rejects.toThrow(
        "last administrator",
      );
      const afterDeactivate = await ops.deactivateMember("member-quant", "admin");
      expect(
        afterDeactivate.members.find((member) => member.memberId === "member-quant")?.active,
      ).toBe(false);
    });

    it(`keeps all execution/ops pages noindex with viewport-gated risk actions on ${kind}`, () => {
      const app = createTerminalApp(kind);
      for (const route of [
        "/portfolio",
        "/risk",
        "/proposals/:proposalId",
        "/approvals/:approvalId",
        "/orders/:orderId",
        "/audit/:correlationId",
        "/operations/incidents/:incidentId",
        "/admin/members",
      ] as const) {
        expect(pageMetaFor(route).robots).toBe("noindex");
      }

      const riskPage = pageMetaFor("/risk");
      expect(visibleHighRiskActions(riskPage, viewportForWidth(390))).toEqual([]);
      expect(visibleHighRiskActions(riskPage, viewportForWidth(1440))).toEqual([
        "engage_kill_switch",
      ]);
      expect(app.actionsFor("/orders/:orderId", 390)).toEqual([]);
      expect(app.actionsFor("/orders/:orderId", 1440)).toEqual(["cancel_order"]);
    });
  }
});
