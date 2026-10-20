import { createStrategyScenario } from "./fixtures/scenarios/strategy.js";
/**
 * L03 acceptance scenarios: the M5 Assisted Live UI gate is reachable only
 * when the server-side flag is on, and deployment targets are always rendered
 * from the BFF payload — identical behavior across web/desktop bindings.
 */

import { describe, expect, it } from "vitest";

import { assistedLiveGate, buildDeploymentTargetSelector } from "@sumalpha/domain-ui";
import type { PlatformKind } from "@sumalpha/platform";

import { createTerminalApp } from "./fixtures/app.js";

async function createPendingRelease(backend: ReturnType<typeof createStrategyScenario>) {
  await backend.runStaticCheck("strategy-001");
  await backend.createBacktest("strategy-001");
  return backend.createRelease("strategy-001");
}

describe("L03 assisted live gate scenarios (web + desktop)", () => {
  for (const kind of ["web", "desktop"] as PlatformKind[]) {
    it(`keeps assisted live 100% unreachable while the M5 flag is off on ${kind}`, async () => {
      const backend = createStrategyScenario();
      expect(await backend.getAssistedLiveTestnetFlag()).toBe(false);

      const release = await createPendingRelease(backend);
      const selector = buildDeploymentTargetSelector(release);
      expect(selector.selectableTargets).toEqual(["paper", "shadow"]);

      const gate = assistedLiveGate(false, release.allowedTargets);
      expect(gate.reachable).toBe(false);
      expect(gate.banner).toContain("尚未开放");
      expect(gate.visibleTargets).toEqual(["paper", "shadow"]);
      expect(gate.visibleTargets).not.toContain("assisted_live");
    });

    it(`opens assisted live for testnet once the flag flips on ${kind}`, async () => {
      const backend = createStrategyScenario();
      backend.setAssistedLiveTestnet(true);
      expect(await backend.getAssistedLiveTestnetFlag()).toBe(true);

      const release = await createPendingRelease(backend);
      const selector = buildDeploymentTargetSelector(release);
      expect(selector.selectableTargets).toEqual(["paper", "shadow", "assisted_live"]);

      const gate = assistedLiveGate(true, release.allowedTargets);
      expect(gate.reachable).toBe(true);
      expect(gate.banner).toContain("双人审批");
      expect(gate.visibleTargets).toContain("assisted_live");
      const assisted = release.allowedTargets.find((option) => option.target === "assisted_live");
      expect(assisted?.enabled).toBe(true);
      expect(assisted?.reason).toContain("testnet");
    });

    it(`derives every gate strictly from server payloads on ${kind}`, async () => {
      const app = createTerminalApp(kind);
      expect(app.platform).toBeDefined();

      // The selector model never synthesizes targets: it only filters the
      // BFF-returned options.
      const backend = createStrategyScenario();
      const release = await createPendingRelease(backend);
      const selector = buildDeploymentTargetSelector(release);
      expect(selector.options).toHaveLength(release.allowedTargets.length);
      expect(selector.hint).toBe("M3/M4 仅允许 Paper 或 Shadow。");
    });
  }
});
