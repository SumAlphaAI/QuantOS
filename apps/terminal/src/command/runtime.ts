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
  if (!decision.allowed) return { decision, contractMode: source.contractMode };
  return { decision, projection: await source.loadProjection(), contractMode: source.contractMode };
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
