/**
 * P12–P14 ops page view models: Audit Explorer, controlled exports,
 * Operations/Incidents with runbook actions, and Admin governance.
 */

import type {
  AdminView,
  AuditEventRow,
  EvidenceChainNode,
  ExportJob,
  IncidentDetail,
  OperationsView,
} from "@sumalpha/api-client";

// ---------------------------------------------------------------------------
// P12 Audit Explorer + exports
// ---------------------------------------------------------------------------

export const AUDIT_COPY = {
  title: "Audit Explorer",
  searchPlaceholder: "输入 correlation ID、订单、策略或研究任务",
  empty: "选择一个记录以查看可验证的证据链。",
  exportHint: "导出将按你的权限范围生成，并记录到审计轨迹。",
} as const;

export interface AuditTimelineModel {
  events: AuditEventRow[];
  redactionComplete: boolean;
}

export function buildAuditTimeline(events: AuditEventRow[]): AuditTimelineModel {
  return {
    events: events.map((event) => ({ ...event })),
    // Every payload value must already be redacted or hashed server-side.
    redactionComplete: events.every((event) =>
      Object.values(event.redactedPayload).every(
        (value) => value === "[redacted]" || value.startsWith("sha256:") || value.length <= 12,
      ),
    ),
  };
}

export interface EvidenceChainModel {
  correlationId: string;
  nodes: EvidenceChainNode[];
  complete: boolean;
}

const REQUIRED_CHAIN_KINDS: EvidenceChainNode["kind"][] = [
  "snapshot",
  "release",
  "proposal",
  "risk_decision",
  "approval",
  "command",
  "order",
  "fill",
];

export function buildEvidenceChain(
  correlationId: string,
  nodes: EvidenceChainNode[],
): EvidenceChainModel {
  const kinds = new Set(nodes.map((node) => node.kind));
  return {
    correlationId,
    nodes: nodes.map((node) => ({ ...node })),
    complete: REQUIRED_CHAIN_KINDS.every((kind) => kinds.has(kind)),
  };
}

export interface ExportJobModel {
  job: ExportJob;
  hint: string;
  downloadable: boolean;
}

export function buildExportJob(job: ExportJob): ExportJobModel {
  return {
    job,
    hint: AUDIT_COPY.exportHint,
    downloadable: job.status === "ready" && job.signedUrl !== null,
  };
}

// ---------------------------------------------------------------------------
// P13 Operations + incidents
// ---------------------------------------------------------------------------

export const OPS_COPY = {
  title: "Operations",
  degraded: "服务处于降级状态。受影响的工作流已按策略限制。",
  runbook: "按照已批准 Runbook 执行。所有操作都会被记录。",
} as const;

export interface OperationsPageModel {
  degradedBanner: string | null;
  services: OperationsView["services"];
  openAlerts: OperationsView["openAlerts"];
  deadLetterCount: number;
}

export function buildOperationsPage(view: OperationsView): OperationsPageModel {
  return {
    degradedBanner: view.degraded ? OPS_COPY.degraded : null,
    services: view.services.map((service) => ({ ...service })),
    openAlerts: view.openAlerts.map((alert) => ({ ...alert })),
    deadLetterCount: view.deadLetterCount,
  };
}

export interface IncidentDetailModel {
  incident: IncidentDetail;
  runbookCopy: string;
  actions: { actionId: string; label: string }[];
}

export function buildIncidentDetail(incident: IncidentDetail): IncidentDetailModel {
  return {
    incident,
    runbookCopy: OPS_COPY.runbook,
    // Only approved runbook actions are ever surfaced; arbitrary commands do
    // not exist in this model.
    actions: incident.runbookActions
      .filter((action) => action.controlled)
      .map((action) => ({ actionId: action.actionId, label: action.label })),
  };
}

// ---------------------------------------------------------------------------
// P14 Admin governance
// ---------------------------------------------------------------------------

export const ADMIN_COPY = {
  title: "Administration",
  members: "角色决定可见范围，不会授予绕过风险控制的权限。",
  capabilities: "仅已签名并通过审核的能力可用于生产工作流。",
  flags: "功能开关不会自动授予实盘权限。",
} as const;

export interface AdminPageModel {
  view: AdminView;
  lastAdminProtected: boolean;
}

export function buildAdminPage(view: AdminView): AdminPageModel {
  const activeAdmins = view.members.filter((member) => member.role === "admin" && member.active);
  return {
    view,
    lastAdminProtected: activeAdmins.length <= 1,
  };
}
