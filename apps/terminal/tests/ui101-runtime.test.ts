import { describe, expect, it } from "vitest";
import { ROUTE_GUARD_ORDER, type GuardCheck, type RouteGuardStep } from "@sumalpha/domain-ui/ui101";

import { ui101CommandFixture } from "../src/command/fixture";
import { createCommandFixtureSource, loadGuardedCommand, type CommandRuntimeSource } from "../src/command/runtime";

function sourceWith(failedAt?: RouteGuardStep, failure: GuardCheck = "deny") {
  const calls: string[] = [];
  const source: CommandRuntimeSource = {
    contractMode: "mocked",
    check: async (step) => {
      calls.push(step);
      return step === failedAt ? failure : "allow";
    },
    loadProjection: async () => {
      calls.push("load_projection");
      return structuredClone(ui101CommandFixture);
    },
  };
  return { calls, source };
}

describe("UI-101 Terminal runtime guard wiring", () => {
  it("loads Command projection only after all six guards pass in order", async () => {
    const { calls, source } = sourceWith();
    const result = await loadGuardedCommand(source);
    expect(result.decision.allowed).toBe(true);
    expect(result.projection?.session.workspaceLabel).toBe("Primary workspace");
    expect(calls).toEqual([...ROUTE_GUARD_ORDER, "load_projection"]);
  });

  it("short-circuits the app source and never loads projection after a denial", async () => {
    const { calls, source } = sourceWith("rbac_capability");
    const result = await loadGuardedCommand(source);
    expect(result.decision).toMatchObject({ allowed: false, stoppedAt: "rbac_capability", destination: "/unauthorized" });
    expect(result.projection).toBeUndefined();
    expect(calls).toEqual(["session", "tenant_workspace", "rbac_capability"]);
  });

  it("fails closed on an unknown mode and does not request data freshness", async () => {
    const { calls, source } = sourceWith("mode", "unknown");
    const result = await loadGuardedCommand(source);
    expect(result.decision).toMatchObject({ allowed: false, stoppedAt: "mode", reason: "未知状态，已安全阻断" });
    expect(calls).toEqual(["session", "tenant_workspace", "rbac_capability", "resource", "mode"]);
  });

  it("runs the generated-type fixture source as Contract Mocked", async () => {
    const result = await loadGuardedCommand(createCommandFixtureSource());
    expect(result.contractMode).toBe("mocked");
    expect(result.decision.completedSteps).toEqual([...ROUTE_GUARD_ORDER]);
    expect(result.projection?.session.capabilities).toContain("command:read");
  });
});
