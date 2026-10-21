import {
  runRouteGuard,
  type GuardCheck,
  type RouteGuardDecision,
  type RouteGuardStep,
} from "@sumalpha/domain-ui/ui101";

import { ui101CommandFixture } from "./fixture";
import type { CommandProjection } from "./model";

export interface CommandRuntimeSource {
  check(step: RouteGuardStep): Promise<GuardCheck>;
  loadProjection(): Promise<CommandProjection>;
  contractMode: "mocked" | "integrated";
  httpStatus?(): number | undefined;
}

export interface GuardedCommandResult {
  decision: RouteGuardDecision;
  projection?: CommandProjection;
  contractMode: CommandRuntimeSource["contractMode"];
}

/** The projection request is unreachable until every mandated guard passes. */
export async function loadGuardedCommand(source: CommandRuntimeSource): Promise<GuardedCommandResult> {
  const decision = await runRouteGuard({
    session: () => source.check("session"),
    tenant_workspace: () => source.check("tenant_workspace"),
    rbac_capability: () => source.check("rbac_capability"),
    resource: () => source.check("resource"),
    mode: () => source.check("mode"),
    data_freshness: () => source.check("data_freshness"),
  });
  if (!decision.allowed) {
    const status = source.httpStatus?.();
    const destination = status === 401 ? "/login" : status === 403 || status === 404 ? "/unauthorized" : status && status >= 500 ? "/maintenance" : decision.destination;
    return { decision: { ...decision, destination }, contractMode: source.contractMode };
  }
  try {
    return { decision, projection: await source.loadProjection(), contractMode: source.contractMode };
  } catch {
    return { decision: { allowed: false, completedSteps: [...decision.completedSteps.slice(0, -1)], stoppedAt: "data_freshness", destination: "/offline", reason: "数据未能安全加载，请重新验证" }, contractMode: source.contractMode };
  }
}

function fixtureDecision(step: RouteGuardStep): GuardCheck {
  const { session, guard, freshness } = ui101CommandFixture as CommandProjection;
  switch (step) {
    case "session":
      return Date.parse(session.expiresAt) > Date.now() && session.mfaState !== "challenged" ? "allow" : "deny";
    case "tenant_workspace":
      return session.tenantId && session.workspaceId && session.accountId ? "allow" : "deny";
    case "rbac_capability":
      return session.capabilities.includes("command:read") ? "allow" : "deny";
    case "resource":
      return guard.resourceAvailable ? "allow" : "deny";
    case "mode":
      return session.mode === "paper" || session.mode === "research" || session.mode === "shadow" ? "allow" : "unknown";
    case "data_freshness":
      return guard.dataAvailable && freshness.state !== "unknown" ? "allow" : "deny";
  }
}

export function createCommandFixtureSource(): CommandRuntimeSource {
  return {
    contractMode: "mocked",
    check: async (step) => fixtureDecision(step),
    loadProjection: async () => structuredClone(ui101CommandFixture),
  };
}
