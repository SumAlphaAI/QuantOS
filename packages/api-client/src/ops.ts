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
