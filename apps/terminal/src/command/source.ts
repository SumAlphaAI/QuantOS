import { bffZodSchemas, parseBffResponse, type BffOperationId } from "@sumalpha/api-client";
import { handleAuthHttpStatus } from "../auth/flow";
import type { CommandProjection, SessionContext } from "./model";
import { commandClient, commandView } from "./gateway";
import { createCommandFixtureSource, type CommandRuntimeSource } from "./runtime";

/** One source per guard run; no cross-account cache or fixture fallback. */
export function createCommandBffSource(origin: string, fetchImpl: typeof fetch = fetch, signal?: AbortSignal): CommandRuntimeSource {
  const client = commandClient(origin, fetchImpl);
  let failureStatus: number | undefined;
  let session: SessionContext | undefined, context: SessionContext | undefined, projection: CommandProjection | undefined;
  const valid = (value?: SessionContext) => !!value && Date.parse(value.expiresAt) > Date.now() && value.mfaState !== "challenged";
  const required = <T>(r: { data?: T; response: Response }, operation: BffOperationId): T => {
    if (r.response.status !== 200) failureStatus = r.response.status;
    if (r.response.status === 401) handleAuthHttpStatus(401, "/command");
    if (r.response.status !== 200 || r.data === undefined) throw new Error("Command access unavailable");
    return parseBffResponse(operation, r.response.status, r.data) as T;
  };
  return {
    contractMode: "integrated",
    httpStatus: () => failureStatus,
    async check(step) {
      if (signal?.aborted) return "unknown";
      switch (step) {
        case "session":
          session = bffZodSchemas.SessionContext.parse(required(await client.GET("/v1/session", { signal }), "getSession"));
          return valid(session) ? "allow" : "deny";
        case "tenant_workspace":
          if (!valid(session)) return "deny";
          context = bffZodSchemas.SessionContext.parse(required(await client.GET("/v1/context", { signal }), "getContext"));
          return valid(context) && context.actorId === session!.actorId && context.tenantId === session!.tenantId && context.workspaceId === session!.workspaceId ? "allow" : "deny";
        case "rbac_capability":
          return context?.capabilities.includes("ops.read") ? "allow" : "deny";
        case "resource":
          return context?.accountId === session?.accountId && !!context?.accountId ? "allow" : "deny";
        case "mode":
          return context?.mode === session?.mode && ["paper", "shadow", "research"].includes(context?.mode ?? "") ? "allow" : "unknown";
        case "data_freshness": {
          if (!valid(session) || !valid(context)) return "deny";
          const raw = required(await client.GET("/v1/command/summary", { params: { query: { accountId: context!.accountId } }, signal }), "getCommandSummary");
          const summary = commandView(raw, context!.accountId, context!.mode);
          if (summary.dataFreshness === "unavailable" || !summary.asOf || Date.parse(summary.asOf) > Date.now() + 1000) return "unknown";
          projection = {
            session: { ...context!, workspaceLabel: `Workspace ${context!.workspaceId.slice(0, 8)}…`, accountLabel: `Account ${context!.accountId.slice(0, 8)}…`, actorInitials: context!.actorId.slice(0, 2).toUpperCase() },
            guard: { resourceAvailable: true, dataAvailable: true },
            freshness: { state: summary.dataFreshness, asOf: summary.asOf },
            risk: { posture: summary.riskPosture === "halted" ? "critical" : summary.riskPosture, reason: "C02 服务端风险事实" },
            summary,
            priority: summary.priority.map(row => ({ severity: row.severity, label: row.kind, summary: row.objectRef, age: row.occurredAt ?? "时间未知", action: "查看" })),
            services: summary.sources.map(row => ({ name: row.domain, status: row.status, tone: row.status === "ready" ? "healthy" : "degraded", latency: "—", availability: row.status === "ready" ? 5 : 0 })),
            activity: summary.recentActivity.map(row => ({ time: row.occurredAt ?? "时间未知", actor: "—", object: row.objectRef, status: row.status, tone: "neutral", id: row.id, detail: "查看" })),
          };
          return "allow";
        }
      }
    },
    async loadProjection() {
      if (signal?.aborted || !valid(session) || !valid(context) || !projection || Date.parse(projection.summary!.expiresAt) <= Date.now()) throw new Error("Command scope expired");
      return structuredClone(projection);
    },
  };
}

export function createConfiguredCommandSource(mockEnabled: boolean, origin?: string, fetchImpl: typeof fetch = fetch, signal?: AbortSignal): CommandRuntimeSource {
  if (mockEnabled) return createCommandFixtureSource();
  if (!origin) return { contractMode: "integrated", check: async () => "unknown", loadProjection: async () => { throw new Error("BFF not configured"); } };
  return createCommandBffSource(origin, fetchImpl, signal);
}
