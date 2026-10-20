/** Test-only UI scenario state. All public asynchronous reads pass the generated contract adapter. */
import type { StrategySummary, StaticCheckResult, StrategyDraftDetail, BacktestReport, ApprovalTimelineEntry, DeploymentTargetOption, StrategyReleaseView} from "@sumalpha/api-client";
import { generatedScenario } from "./transport.js";
interface StrategyBackend {
  /** Server-side M5 feature flag; the frontend never derives it locally. */
  getAssistedLiveTestnetFlag(): Promise<boolean>;
  listStrategies(): Promise<StrategySummary[]>;
  getStrategyDraft(strategyId: string): Promise<StrategyDraftDetail>;
  runStaticCheck(strategyId: string): Promise<StaticCheckResult>;
  createBacktest(strategyId: string): Promise<BacktestReport>;
  getBacktest(runId: string): Promise<BacktestReport>;
  createRelease(strategyId: string): Promise<StrategyReleaseView>;
  listReleases(): Promise<StrategyReleaseView[]>;
  getRelease(releaseId: string): Promise<StrategyReleaseView>;
  approveRelease(releaseId: string, actor: string): Promise<StrategyReleaseView>;
  rejectRelease(releaseId: string, actor: string, note: string): Promise<StrategyReleaseView>;
}
function deploymentTargetsFor(assistedLiveTestnet: boolean): DeploymentTargetOption[] {
  const base: DeploymentTargetOption[] = [
    { target: "paper", enabled: true, reason: null },
    { target: "shadow", enabled: true, reason: null },
  ];
  if (assistedLiveTestnet) {
    base.push({
      target: "assisted_live",
      enabled: true,
      reason: "Assisted Live（testnet）已按 M5 flag 开放。",
    });
  } else {
    base.push({
      target: "assisted_live",
      enabled: false,
      reason: "Assisted Live 尚未开放。需完成 M5 Gate 并获得单独批准。",
    });
  }
  return base;
}

class ScenarioStrategyState implements StrategyBackend {
  private drafts = new Map<string, StrategyDraftDetail>();
  private backtests = new Map<string, BacktestReport>();
  private releases = new Map<string, StrategyReleaseView>();
  private nextBacktest = 0;
  private nextRelease = 0;
  private nextTimeline = 0;
  private assistedLiveTestnet = false;
  private readonly now = "2026-08-01T00:00:00Z";

  constructor() {
    for (let index = 0; index < 20; index += 1) {
      const strategyId = `strategy-${String(index + 1).padStart(3, "0")}`;
      this.drafts.set(strategyId, {
        strategyId,
        name: `trend.alpha.${index + 1}`,
        draftVersion: 1,
        rule: "momentum",
        parameters: {
          lookback: 20 + (index % 10),
          entry_threshold_bps: 25,
          exit_threshold_bps: -12,
        },
        staticCheck: null,
        backtestRunId: null,
        dataSnapshotId: "snapshot-btc-2026-07-31",
        evidenceRefs: [`evidence-research-${index + 1}`],
      });
    }
  }

  async getAssistedLiveTestnetFlag(): Promise<boolean> {
    return this.assistedLiveTestnet;
  }

  /** Test hook: flip the server-side M5 testnet flag. */
  setAssistedLiveTestnet(enabled: boolean): void {
    this.assistedLiveTestnet = enabled;
  }

  async listStrategies(): Promise<StrategySummary[]> {
    return [...this.drafts.values()].map((draft) => ({
      strategyId: draft.strategyId,
      name: draft.name,
      status: draft.backtestRunId
        ? "backtested"
        : draft.staticCheck?.passed
          ? "checked"
          : "draft",
      draftVersion: draft.draftVersion,
      updatedAt: this.now,
    }));
  }

  async getStrategyDraft(strategyId: string): Promise<StrategyDraftDetail> {
    const draft = this.drafts.get(strategyId);
    if (!draft) {
      throw new Error(`strategy ${strategyId} not found`);
    }
    return { ...draft, parameters: { ...draft.parameters } };
  }

  async runStaticCheck(strategyId: string): Promise<StaticCheckResult> {
    const draft = this.drafts.get(strategyId);
    if (!draft) {
      throw new Error(`strategy ${strategyId} not found`);
    }
    const result: StaticCheckResult = { passed: true, findings: [] };
    draft.staticCheck = result;
    this.drafts.set(strategyId, draft);
    return { ...result };
  }

  async createBacktest(strategyId: string): Promise<BacktestReport> {
    const draft = this.drafts.get(strategyId);
    if (!draft) {
      throw new Error(`strategy ${strategyId} not found`);
    }
    if (!draft.staticCheck?.passed) {
      throw new Error("static check must pass before creating a backtest");
    }
    this.nextBacktest += 1;
    const runId = `backtest-${String(this.nextBacktest).padStart(4, "0")}`;
    const lookback = Number(draft.parameters.lookback ?? 20);
    const report: BacktestReport = {
      runId,
      strategyId,
      inputHash: `sha256:input-${runId}`,
      environmentHash: `sha256:env-${runId}`,
      reportHash: `sha256:report-${runId}`,
      totalReturn: 0.02 + (lookback % 7) * 0.001,
      maxDrawdown: 0.03,
      sharpe: 1.2,
      tradeCount: 12 + (lookback % 5),
      feesTotal: 18.5,
      slippageTotal: 9.25,
      leakCheckViolations: 0,
      generatedAt: this.now,
    };
    draft.backtestRunId = runId;
    this.drafts.set(strategyId, draft);
    this.backtests.set(runId, report);
    return { ...report };
  }

  async getBacktest(runId: string): Promise<BacktestReport> {
    const report = this.backtests.get(runId);
    if (!report) {
      throw new Error(`backtest ${runId} not found`);
    }
    return { ...report };
  }

  async createRelease(strategyId: string): Promise<StrategyReleaseView> {
    const draft = this.drafts.get(strategyId);
    if (!draft) {
      throw new Error(`strategy ${strategyId} not found`);
    }
    if (!draft.staticCheck?.passed || !draft.backtestRunId) {
      throw new Error("validated static check and backtest are required for a release");
    }
    const backtest = this.backtests.get(draft.backtestRunId);
    if (!backtest || backtest.leakCheckViolations > 0) {
      throw new Error("backtest with violations cannot be released");
    }
    this.nextRelease += 1;
    const releaseId = `release-${String(this.nextRelease).padStart(4, "0")}`;
    const release: StrategyReleaseView = {
      releaseId,
      strategyId,
      name: draft.name,
      contentHash: `sha256:release-${draft.strategyId}-v${draft.draftVersion}`,
      backtestReportHash: backtest.reportHash,
      approvalState: "pending",
      allowedTargets: deploymentTargetsFor(this.assistedLiveTestnet),
      timeline: [this.timelineEntry("submitted", "strategy-owner", "发布候选已提交审批")],
      createdAt: this.now,
    };
    this.releases.set(releaseId, release);
    return structuredCloneRelease(release);
  }

  async listReleases(): Promise<StrategyReleaseView[]> {
    return [...this.releases.values()].map(structuredCloneRelease);
  }

  async getRelease(releaseId: string): Promise<StrategyReleaseView> {
    const release = this.releases.get(releaseId);
    if (!release) {
      throw new Error(`release ${releaseId} not found`);
    }
    return structuredCloneRelease(release);
  }

  async approveRelease(releaseId: string, actor: string): Promise<StrategyReleaseView> {
    const release = this.mustGet(releaseId);
    if (release.approvalState === "approved") {
      // Concurrent second approval surfaces a deterministic conflict state.
      release.approvalState = "conflict";
      release.timeline.push(
        this.timelineEntry("conflict_detected", actor, "检测到并发审批冲突"),
      );
      this.releases.set(releaseId, release);
      return structuredCloneRelease(release);
    }
    if (release.approvalState !== "pending") {
      throw new Error(`release ${releaseId} is not pending approval`);
    }
    release.approvalState = "approved";
    release.timeline.push(this.timelineEntry("approved", actor, "审批通过，允许 Paper/Shadow 部署"));
    this.releases.set(releaseId, release);
    return structuredCloneRelease(release);
  }

  async rejectRelease(releaseId: string, actor: string, note: string): Promise<StrategyReleaseView> {
    const release = this.mustGet(releaseId);
    if (release.approvalState !== "pending") {
      throw new Error(`release ${releaseId} is not pending approval`);
    }
    release.approvalState = "rejected";
    release.timeline.push(this.timelineEntry("rejected", actor, note || "审批拒绝"));
    this.releases.set(releaseId, release);
    return structuredCloneRelease(release);
  }

  /** Test hook: expire a pending release (e.g. approval SLA elapsed). */
  expireRelease(releaseId: string): StrategyReleaseView {
    const release = this.mustGet(releaseId);
    if (release.approvalState === "pending") {
      release.approvalState = "expired";
      release.timeline.push(
        this.timelineEntry("expired", "system", "审批超时，发布候选已过期"),
      );
      this.releases.set(releaseId, release);
    }
    return structuredCloneRelease(release);
  }

  private mustGet(releaseId: string): StrategyReleaseView {
    const release = this.releases.get(releaseId);
    if (!release) {
      throw new Error(`release ${releaseId} not found`);
    }
    return release;
  }

  private timelineEntry(
    action: ApprovalTimelineEntry["action"],
    actor: string,
    note: string,
  ): ApprovalTimelineEntry {
    this.nextTimeline += 1;
    return {
      entryId: `timeline-${this.nextTimeline}`,
      actor,
      action,
      at: this.now,
      note,
    };
  }
}

function structuredCloneRelease(release: StrategyReleaseView): StrategyReleaseView {
  return {
    ...release,
    allowedTargets: release.allowedTargets.map((option) => ({ ...option })),
    timeline: release.timeline.map((entry) => ({ ...entry })),
  };
}

export function createStrategyScenario() { return generatedScenario("strategy", new ScenarioStrategyState()); }
