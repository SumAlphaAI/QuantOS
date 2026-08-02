/**
 * Operations domain typed client (P12–P14): audit explorer, controlled
 * exports, operations/incidents with runbook actions, and admin governance.
 */

export interface AuditEventRow {
  eventId: string;
  correlationId: string;
  kind: string;
  actor: string;
  at: string;
  objectRef: string;
  /** Field-level redaction is applied before payloads reach the client. */
  redactedPayload: Record<string, string>;
}

export interface EvidenceChainNode {
  ref: string;
  kind: "research" | "proposal" | "risk_decision" | "approval" | "command" | "order" | "fill" | "release" | "snapshot";
  route: string;
  hash: string;
}

export type ExportJobStatus = "queued" | "generating" | "ready" | "expired";

export interface ExportJob {
  exportId: string;
  scope: string;
  status: ExportJobStatus;
  requestedBy: string;
  requestedAt: string;
  signedUrl: string | null;
}

export type ServiceHealth = "healthy" | "degraded" | "down";

export interface OperationsView {
  services: { name: string; health: ServiceHealth; latencyMs: number }[];
  deadLetterCount: number;
  openAlerts: { alertId: string; severity: string; summary: string }[];
  degraded: boolean;
}

export interface IncidentDetail {
  incidentId: string;
  title: string;
  timeline: { at: string; note: string }[];
  impact: string;
  runbookActions: { actionId: string; label: string; controlled: true }[];
  actionLog: { at: string; actor: string; actionId: string }[];
}

export interface AdminMember {
  memberId: string;
  displayName: string;
  role: string;
  active: boolean;
}

export interface AdminView {
  members: AdminMember[];
  capabilities: { name: string; approved: boolean; signed: boolean }[];
  featureFlags: { name: string; enabled: boolean }[];
}

export interface OpsBackend {
  searchAudit(query: string): Promise<AuditEventRow[]>;
  getEvidenceChain(correlationId: string): Promise<EvidenceChainNode[]>;
  createExportJob(scope: string, actor: string): Promise<ExportJob>;
  getExportJob(exportId: string): Promise<ExportJob>;
  getOperationsView(): Promise<OperationsView>;
  getIncident(incidentId: string): Promise<IncidentDetail>;
  runRunbookAction(incidentId: string, actionId: string, actor: string): Promise<IncidentDetail>;
  getAdminView(): Promise<AdminView>;
  deactivateMember(memberId: string, actor: string): Promise<AdminView>;
}

const NOW = "2026-08-01T00:00:00Z";

/** Deterministic ops backend: order -> full evidence chain in one hop. */
export class InMemoryOpsBackend implements OpsBackend {
  private exports = new Map<string, ExportJob>();
  private incidents = new Map<string, IncidentDetail>();
  private admin: AdminView = {
    members: [
      { memberId: "member-admin", displayName: "Workspace Admin", role: "admin", active: true },
      { memberId: "member-quant", displayName: "Quant Researcher", role: "quant", active: true },
      { memberId: "member-risk", displayName: "Risk Officer", role: "risk", active: true },
    ],
    capabilities: [
      { name: "research.hypothesis.v1", approved: true, signed: true },
      { name: "decision.proposal.v1", approved: true, signed: true },
    ],
    featureFlags: [{ name: "terminal.ops.v1", enabled: true }],
  };

  constructor() {
    this.incidents.set("incident-0001", {
      incidentId: "incident-0001",
      title: "Engine 延迟升高",
      timeline: [{ at: NOW, note: "engine p95 latency above threshold" }],
      impact: "research workflows delayed",
      runbookActions: [{ actionId: "controlled-retry", label: "请求受控重试", controlled: true }],
      actionLog: [],
    });
  }

  async searchAudit(query: string): Promise<AuditEventRow[]> {
    if (!query.trim()) {
      return [];
    }
    return [
      {
        eventId: "audit-1",
        correlationId: "corr-order-0001",
        kind: "order.filled",
        actor: "execution-gateway",
        at: NOW,
        objectRef: "order-0001",
        redactedPayload: { account: "[redacted]", symbol: "BTCUSDT" },
      },
      {
        eventId: "audit-2",
        correlationId: "corr-order-0001",
        kind: "command.issued",
        actor: "quantos-execution.v1",
        at: NOW,
        objectRef: "command-0001",
        redactedPayload: { signature: "sha256:command-0001" },
      },
    ];
  }

  async getEvidenceChain(correlationId: string): Promise<EvidenceChainNode[]> {
    if (correlationId !== "corr-order-0001") {
      throw new Error(`correlation ${correlationId} not found`);
    }
    return [
      { ref: "snapshot-btc-2026-07-31", kind: "snapshot", route: "/data-snapshots/snapshot-btc-2026-07-31", hash: "sha256:snapshot" },
      { ref: "release-0001", kind: "release", route: "/releases/release-0001", hash: "sha256:release" },
      { ref: "proposal-0001", kind: "proposal", route: "/proposals/proposal-0001", hash: "sha256:proposal" },
      { ref: "decision-0001", kind: "risk_decision", route: "/approvals/approval-0001", hash: "sha256:decision" },
      { ref: "approval-0001", kind: "approval", route: "/approvals/approval-0001", hash: "sha256:approval" },
      { ref: "command-0001", kind: "command", route: "/orders/order-0001", hash: "sha256:command" },
      { ref: "order-0001", kind: "order", route: "/orders/order-0001", hash: "sha256:order" },
      { ref: "fill-0001", kind: "fill", route: "/orders/order-0001", hash: "sha256:fill" },
    ];
  }

  async createExportJob(scope: string, actor: string): Promise<ExportJob> {
    const exportId = `export-${this.exports.size + 1}`;
    const job: ExportJob = {
      exportId,
      scope,
      status: "queued",
      requestedBy: actor,
      requestedAt: NOW,
      signedUrl: null,
    };
    this.exports.set(exportId, job);
    return { ...job };
  }

  async getExportJob(exportId: string): Promise<ExportJob> {
    const job = this.exports.get(exportId);
    if (!job) {
      throw new Error(`export ${exportId} not found`);
    }
    if (job.status === "queued") {
      job.status = "ready";
      job.signedUrl = `https://exports.sumalpha.ai/${exportId}?signature=sha256:${exportId}`;
      this.exports.set(exportId, job);
    }
    return { ...job };
  }

  async getOperationsView(): Promise<OperationsView> {
    return {
      services: [
        { name: "runtime-gateway", health: "healthy", latencyMs: 12 },
        { name: "engine-manager", health: "degraded", latencyMs: 240 },
        { name: "market-ingestor", health: "healthy", latencyMs: 8 },
      ],
      deadLetterCount: 0,
      openAlerts: [{ alertId: "alert-1", severity: "warning", summary: "engine p95 latency high" }],
      degraded: true,
    };
  }

  async getIncident(incidentId: string): Promise<IncidentDetail> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`incident ${incidentId} not found`);
    }
    return {
      ...incident,
      timeline: incident.timeline.map((entry) => ({ ...entry })),
      runbookActions: incident.runbookActions.map((action) => ({ ...action })),
      actionLog: incident.actionLog.map((entry) => ({ ...entry })),
    };
  }

  async runRunbookAction(incidentId: string, actionId: string, actor: string): Promise<IncidentDetail> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`incident ${incidentId} not found`);
    }
    if (!incident.runbookActions.some((action) => action.actionId === actionId)) {
      throw new Error(`runbook action ${actionId} is not an approved action`);
    }
    incident.actionLog.push({ at: NOW, actor, actionId });
    this.incidents.set(incidentId, incident);
    return this.getIncident(incidentId);
  }

  async getAdminView(): Promise<AdminView> {
    return {
      members: this.admin.members.map((member) => ({ ...member })),
      capabilities: this.admin.capabilities.map((capability) => ({ ...capability })),
      featureFlags: this.admin.featureFlags.map((flag) => ({ ...flag })),
    };
  }

  async deactivateMember(memberId: string, actor: string): Promise<AdminView> {
    void actor;
    const activeAdmins = this.admin.members.filter(
      (member) => member.role === "admin" && member.active,
    );
    const target = this.admin.members.find((member) => member.memberId === memberId);
    if (!target) {
      throw new Error(`member ${memberId} not found`);
    }
    if (target.role === "admin" && activeAdmins.length <= 1) {
      throw new Error("cannot deactivate the last administrator");
    }
    target.active = false;
    return this.getAdminView();
  }
}
