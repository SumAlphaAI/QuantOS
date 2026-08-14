/**
 * BFF typed client for the shared QuantOS Terminal.
 *
 * The client speaks to a typed `TerminalBackend` transport. Production wires
 * it to the BFF HTTP endpoints; tests and offline development use the
 * deterministic `InMemoryTerminalBackend`.
 */

export type ResearchRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancel_requested"
  | "cancelled";

export interface ResearchRunSummary {
  runId: string;
  title: string;
  status: ResearchRunStatus;
  capability: string;
  dataSnapshotId: string;
  createdAt: string;
  correlationId: string;
}

export interface ResearchStreamEvent {
  sequence: number;
  runId: string;
  done: boolean;
  phase: string;
  payload: Record<string, string | number | boolean>;
}

export interface ResearchEvidence {
  evidenceId: string;
  artifactId: string;
  summary: string;
}

export interface ResearchRunDetail extends ResearchRunSummary {
  inputHash: string;
  costUnits: number;
  evidence: ResearchEvidence[];
  artifactIds: string[];
}

export interface CreateResearchRunInput {
  title: string;
  question: string;
  capability: string;
  dataSnapshotId: string;
  budgetUnits: number;
  deadlineAt: string;
}

export type SnapshotQuality = "pending" | "passed" | "degraded" | "failed";

export interface DataSnapshotSummary {
  snapshotId: string;
  contentHash: string;
  symbols: string[];
  quality: SnapshotQuality;
  licenseLabel: string;
  capturedAt: string;
  expiresAt: string;
  usableForTrading: boolean;
}

export interface CommandCenterView {
  modeBanner: string;
  pendingApprovals: number;
  openRiskAlerts: number;
  failedRuns: number;
  sampledAt: string;
}

export interface TerminalSession {
  actorId: string;
  workspaceId: string;
  capabilities: string[];
  mfaSatisfied: boolean;
}

export interface TerminalBackend {
  getSession(): Promise<TerminalSession>;
  getCommandCenter(): Promise<CommandCenterView>;
  listResearchRuns(): Promise<ResearchRunSummary[]>;
  createResearchRun(input: CreateResearchRunInput): Promise<ResearchRunDetail>;
  getResearchRun(runId: string): Promise<ResearchRunDetail>;
  /** Stream events strictly after `afterSequence` (for reconnect catch-up). */
  streamResearchEvents(runId: string, afterSequence: number): Promise<ResearchStreamEvent[]>;
  cancelResearchRun(runId: string): Promise<ResearchRunStatus>;
  listDataSnapshots(): Promise<DataSnapshotSummary[]>;
  getDataSnapshot(snapshotId: string): Promise<DataSnapshotSummary>;
}

/**
 * @deprecated G0 未冻结项 #3：手写 InMemory backend 明确标记为待删除（执行计划 1.3/3.2）。
 * 仅允许作为场景 fixture 使用；BFF-FE-000 OpenAPI 冻结后，本类必须迁移为实现
 * 生成接口的测试 adapter，或随生成式 MSW（tests/contract/handlers.ts）上线而删除。
 * 页面组件禁止引用。
 */
export class InMemoryTerminalBackend implements TerminalBackend {
  private readonly session: TerminalSession = {
    actorId: "actor-primary",
    workspaceId: "workspace-primary",
    capabilities: ["research.hypothesis.v1", "research.experiment.v1"],
    mfaSatisfied: true,
  };

  private runs = new Map<string, ResearchRunDetail>();
  private events = new Map<string, ResearchStreamEvent[]>();
  private cancelRequested = new Set<string>();
  private nextRun = 0;

  private readonly snapshots: DataSnapshotSummary[] = [
    {
      snapshotId: "snapshot-btc-2026-07-31",
      contentHash: "sha256:btc-snapshot",
      symbols: ["BTCUSDT"],
      quality: "passed",
      licenseLabel: "internal-approved",
      capturedAt: "2026-07-31T00:00:05Z",
      expiresAt: "2026-08-01T00:00:05Z",
      usableForTrading: true,
    },
    {
      snapshotId: "snapshot-eth-degraded",
      contentHash: "sha256:eth-snapshot",
      symbols: ["ETHUSDT"],
      quality: "degraded",
      licenseLabel: "internal-approved",
      capturedAt: "2026-07-31T00:00:05Z",
      expiresAt: "2026-08-01T00:00:05Z",
      usableForTrading: false,
    },
  ];

  async getSession(): Promise<TerminalSession> {
    return this.session;
  }

  async getCommandCenter(): Promise<CommandCenterView> {
    return {
      modeBanner: "Paper mode — 研究、风险与运行状态。",
      pendingApprovals: 0,
      openRiskAlerts: 0,
      failedRuns: [...this.runs.values()].filter((run) => run.status === "failed").length,
      sampledAt: "2026-08-01T00:00:00Z",
    };
  }

  async listResearchRuns(): Promise<ResearchRunSummary[]> {
    return [...this.runs.values()].map((detail) => ({ ...detail }));
  }

  async createResearchRun(input: CreateResearchRunInput): Promise<ResearchRunDetail> {
    if (!this.session.capabilities.includes(input.capability)) {
      throw new Error(`capability ${input.capability} is not authorized`);
    }
    const snapshot = this.snapshots.find((entry) => entry.snapshotId === input.dataSnapshotId);
    if (!snapshot) {
      throw new Error(`data snapshot ${input.dataSnapshotId} is not available`);
    }
    this.nextRun += 1;
    const runId = `run-${String(this.nextRun).padStart(4, "0")}`;
    const detail: ResearchRunDetail = {
      runId,
      title: input.title,
      status: "queued",
      capability: input.capability,
      dataSnapshotId: input.dataSnapshotId,
      createdAt: "2026-08-01T00:00:00Z",
      correlationId: `corr-${runId}`,
      inputHash: `sha256:input-${runId}`,
      costUnits: 0,
      evidence: [
        {
          evidenceId: `evidence-${runId}-1`,
          artifactId: `artifact-${runId}-hypothesis`,
          summary: "hypothesis draft",
        },
        {
          evidenceId: `evidence-${runId}-2`,
          artifactId: `artifact-${runId}-experiment`,
          summary: "experiment summary",
        },
      ],
      artifactIds: [`artifact-${runId}-hypothesis`, `artifact-${runId}-experiment`],
    };
    this.runs.set(runId, detail);
    this.events.set(runId, [
      { sequence: 1, runId, done: false, phase: "queued", payload: { runId } },
      { sequence: 2, runId, done: false, phase: "dispatch", payload: { capability: input.capability } },
      { sequence: 3, runId, done: true, phase: "completed", payload: { evidenceCount: 2 } },
    ]);
    return { ...detail };
  }

  async getResearchRun(runId: string): Promise<ResearchRunDetail> {
    const detail = this.runs.get(runId);
    if (!detail) {
      throw new Error(`research run ${runId} not found`);
    }
    if (this.cancelRequested.has(runId) && detail.status === "cancel_requested") {
      detail.status = "cancelled";
      this.runs.set(runId, detail);
    }
    return { ...detail };
  }

  async streamResearchEvents(runId: string, afterSequence: number): Promise<ResearchStreamEvent[]> {
    const events = this.events.get(runId);
    if (!events) {
      throw new Error(`research run ${runId} not found`);
    }
    return events.filter((event) => event.sequence > afterSequence).map((event) => ({ ...event }));
  }

  async cancelResearchRun(runId: string): Promise<ResearchRunStatus> {
    const detail = this.runs.get(runId);
    if (!detail) {
      throw new Error(`research run ${runId} not found`);
    }
    if (this.cancelRequested.has(runId)) {
      detail.status = "cancelled";
      this.runs.set(runId, detail);
      return "cancelled";
    }
    this.cancelRequested.add(runId);
    detail.status = "cancel_requested";
    this.runs.set(runId, detail);
    const events = this.events.get(runId) ?? [];
    const nextSequence = (events.at(-1)?.sequence ?? 0) + 1;
    events.push({ sequence: nextSequence, runId, done: true, phase: "cancelled", payload: {} });
    this.events.set(runId, events);
    return "cancel_requested";
  }

  async listDataSnapshots(): Promise<DataSnapshotSummary[]> {
    return this.snapshots.map((snapshot) => ({ ...snapshot }));
  }

  async getDataSnapshot(snapshotId: string): Promise<DataSnapshotSummary> {
    const snapshot = this.snapshots.find((entry) => entry.snapshotId === snapshotId);
    if (!snapshot) {
      throw new Error(`data snapshot ${snapshotId} not found`);
    }
    return { ...snapshot };
  }
}

export class TerminalClient {
  constructor(private readonly backend: TerminalBackend) {}

  get session(): Promise<TerminalSession> {
    return this.backend.getSession();
  }

  get commandCenter(): Promise<CommandCenterView> {
    return this.backend.getCommandCenter();
  }

  listResearchRuns(): Promise<ResearchRunSummary[]> {
    return this.backend.listResearchRuns();
  }

  createResearchRun(input: CreateResearchRunInput): Promise<ResearchRunDetail> {
    return this.backend.createResearchRun(input);
  }

  getResearchRun(runId: string): Promise<ResearchRunDetail> {
    return this.backend.getResearchRun(runId);
  }

  streamResearchEvents(runId: string, afterSequence: number): Promise<ResearchStreamEvent[]> {
    return this.backend.streamResearchEvents(runId, afterSequence);
  }

  cancelResearchRun(runId: string): Promise<ResearchRunStatus> {
    return this.backend.cancelResearchRun(runId);
  }

  listDataSnapshots(): Promise<DataSnapshotSummary[]> {
    return this.backend.listDataSnapshots();
  }

  getDataSnapshot(snapshotId: string): Promise<DataSnapshotSummary> {
    return this.backend.getDataSnapshot(snapshotId);
  }
}

export function createTerminalClient(backend: TerminalBackend): TerminalClient {
  return new TerminalClient(backend);
}
