/**
 * S04 acceptance scenarios: 20 strategy fixtures complete the research-to-
 * release lifecycle; rejected/expired/concurrent-approval states are explicit;
 * deployment targets come from the BFF payload; the same matrix runs on both
 * web and desktop bindings.
 */

import { describe, expect, it } from "vitest";
import { InMemoryStrategyBackend } from "@sumalpha/api-client";
import {
  approvalActionVisibility,
  buildApprovalTimeline,
  buildBacktestDetail,
  buildDeploymentTargetSelector,
  buildStrategyCatalog,
  buildValidationPanel,
  labActions,
  pageMetaFor,
  visibleHighRiskActions,
  viewportForWidth,
} from "@sumalpha/domain-ui";
import type { PlatformKind } from "@sumalpha/platform";

import { createTerminalApp } from "../src/app.js";

const APPROVER = { capabilities: ["strategy.approve"] };

describe("S04 strategy lifecycle scenarios (web + desktop)", () => {
  for (const kind of ["web", "desktop"] as PlatformKind[]) {
    it(`completes 20 fixtures from draft to release on ${kind}`, async () => {
      const backend = new InMemoryStrategyBackend();
      const summaries = await backend.listStrategies();
      expect(summaries).toHaveLength(20);

      const catalog = buildStrategyCatalog(summaries);
      expect(catalog[0]?.labRoute).toBe(`/strategies/${catalog[0]?.strategyId}/lab`);

      for (const summary of summaries) {
        const draft = await backend.getStrategyDraft(summary.strategyId);

        // Lab gates: backtest blocked until static check passes.
        const gated = labActions(draft, null, true);
        expect(gated.find((action) => action.action === "create_backtest")?.enabled).toBe(false);
        expect(gated.find((action) => action.action === "submit_release")?.enabled).toBe(false);

        const check = await backend.runStaticCheck(draft.strategyId);
        expect(check.passed).toBe(true);

        const report = await backend.createBacktest(draft.strategyId);
        const detail = buildBacktestDetail(report);
        expect(detail.leakCheckClean).toBe(true);
        expect(detail.reportHash).toMatch(/^sha256:/);
        expect(detail.costs.feesTotal).toBeGreaterThan(0);

        const afterBacktest = await backend.getStrategyDraft(draft.strategyId);
        const panel = buildValidationPanel(afterBacktest, report);
        expect(panel.blockers).toEqual([]);
        const unlocked = labActions(afterBacktest, report, true);
        expect(unlocked.find((action) => action.action === "submit_release")?.enabled).toBe(true);

        const release = await backend.createRelease(draft.strategyId);
        expect(release.approvalState).toBe("pending");
        expect(release.contentHash).toMatch(/^sha256:/);
        expect(release.backtestReportHash).toBe(report.reportHash);

        // Deployment targets come from the BFF payload: paper/shadow enabled,
        // assisted live locked with the M5 reason; frontend never hard-codes.
        const selector = buildDeploymentTargetSelector(release);
        expect(selector.selectableTargets).toEqual(["paper", "shadow"]);
        const assistedLive = selector.options.find((option) => option.target === "assisted_live");
        expect(assistedLive?.enabled).toBe(false);
        expect(assistedLive?.reason).toContain("M5 Gate");
        expect(selector.hint).toBe("M3/M4 仅允许 Paper 或 Shadow。");

        // Approver sees actions while pending; non-approver does not.
        expect(
          approvalActionVisibility(APPROVER.capabilities, release.approvalState),
        ).toEqual({ canApprove: true, canReject: true });
        expect(approvalActionVisibility([], release.approvalState)).toEqual({
          canApprove: false,
          canReject: false,
        });

        const approved = await backend.approveRelease(release.releaseId, "risk-approver");
        const timeline = buildApprovalTimeline(approved);
        expect(timeline.stateLabel).toBe("已通过");
        expect(timeline.deployable).toBe(true);
        expect(timeline.entries.at(-1)?.actionLabel).toBe("审批通过");
      }

      const releases = await backend.listReleases();
      expect(releases).toHaveLength(20);
      expect(releases.every((release) => release.approvalState === "approved")).toBe(true);
    });

    it(`surfaces rejected, expired, and concurrent-approval states on ${kind}`, async () => {
      const backend = new InMemoryStrategyBackend();

      // rejected
      await backend.runStaticCheck("strategy-001");
      await backend.createBacktest("strategy-001");
      const rejectedCandidate = await backend.createRelease("strategy-001");
      const rejected = await backend.rejectRelease(
        rejectedCandidate.releaseId,
        "risk-approver",
        "参数超出限额",
      );
      const rejectedTimeline = buildApprovalTimeline(rejected);
      expect(rejectedTimeline.stateLabel).toBe("已拒绝");
      expect(rejectedTimeline.deployable).toBe(false);
      expect(rejectedTimeline.entries.at(-1)?.note).toBe("参数超出限额");
      await expect(
        backend.approveRelease(rejected.releaseId, "risk-approver"),
      ).rejects.toThrow("not pending");

      // expired
      await backend.runStaticCheck("strategy-002");
      await backend.createBacktest("strategy-002");
      const expiringCandidate = await backend.createRelease("strategy-002");
      const expired = backend.expireRelease(expiringCandidate.releaseId);
      const expiredTimeline = buildApprovalTimeline(expired);
      expect(expiredTimeline.stateLabel).toBe("已过期");
      expect(expiredTimeline.deployable).toBe(false);
      expect(expiredTimeline.entries.at(-1)?.actionLabel).toBe("已过期");

      // concurrent approval -> deterministic conflict
      await backend.runStaticCheck("strategy-003");
      await backend.createBacktest("strategy-003");
      const conflictCandidate = await backend.createRelease("strategy-003");
      await backend.approveRelease(conflictCandidate.releaseId, "approver-a");
      const conflicted = await backend.approveRelease(conflictCandidate.releaseId, "approver-b");
      const conflictTimeline = buildApprovalTimeline(conflicted);
      expect(conflictTimeline.stateLabel).toBe("并发冲突");
      expect(conflictTimeline.deployable).toBe(false);
      expect(conflictTimeline.entries.at(-1)?.actionLabel).toBe("并发冲突");
    });

    it(`keeps release pages noindex and gates high-risk actions by viewport on ${kind}`, () => {
      const app = createTerminalApp(kind);
      for (const route of [
        "/strategies",
        "/strategies/new",
        "/strategies/:strategyId/lab",
        "/backtests/:runId",
        "/releases",
        "/releases/:releaseId",
      ] as const) {
        expect(pageMetaFor(route).robots).toBe("noindex");
      }

      const releaseDetail = pageMetaFor("/releases/:releaseId");
      expect(
        visibleHighRiskActions(releaseDetail, viewportForWidth(390)),
      ).toEqual([]);
      expect(
        visibleHighRiskActions(releaseDetail, viewportForWidth(1440)),
      ).toEqual(["approve_release", "select_deployment_target"]);
      expect(app.actionsFor("/strategies/:strategyId/lab", 390)).toEqual([]);
      expect(app.actionsFor("/strategies/:strategyId/lab", 1440)).toEqual(["submit_release"]);
    });
  }
});
