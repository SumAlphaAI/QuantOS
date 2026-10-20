/**
 * BFF typed client for the shared QuantOS Terminal.
 *
 * Compatibility read-model types for existing domain UI.
 * Production HTTP consumes generated BFF contracts; scenario state lives only in tests.
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



export interface TerminalClient {
  readonly session: Promise<TerminalSession>;
  readonly commandCenter: Promise<CommandCenterView>;
  listResearchRuns(): Promise<ResearchRunSummary[]>;
  createResearchRun(input: CreateResearchRunInput): Promise<ResearchRunDetail>;
  getResearchRun(runId: string): Promise<ResearchRunDetail>;
  /** Stream events strictly after `afterSequence` (for reconnect catch-up). */
  streamResearchEvents(runId: string, afterSequence: number): Promise<ResearchStreamEvent[]>;
  cancelResearchRun(runId: string): Promise<ResearchRunStatus>;
  listDataSnapshots(): Promise<DataSnapshotSummary[]>;
  getDataSnapshot(snapshotId: string): Promise<DataSnapshotSummary>;
}
