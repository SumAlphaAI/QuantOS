import { describe, expect, it } from "vitest";

import {
  ROUTE_GUARD_ORDER,
  evaluateRouteGuard,
  runRouteGuard,
  visibleShellNavigation,
  writesAllowed,
  type GuardCheck,
} from "../src/ui101.js";

const all = (value: GuardCheck) =>
  Object.fromEntries(ROUTE_GUARD_ORDER.map((step) => [step, value])) as Record<
    (typeof ROUTE_GUARD_ORDER)[number],
    GuardCheck
  >;

describe("UI-101 route guard", () => {
  it("allows only after every guard passes in the mandated order", () => {
    expect(evaluateRouteGuard({ checks: all("allow") })).toEqual({
      allowed: true,
      completedSteps: [...ROUTE_GUARD_ORDER],
    });
  });

  it.each(ROUTE_GUARD_ORDER)("stops before later requests when %s fails", (failedStep) => {
    const checks = all("allow");
    checks[failedStep] = "deny";
    const decision = evaluateRouteGuard({ checks });
    const failedIndex = ROUTE_GUARD_ORDER.indexOf(failedStep);
    expect(decision.allowed).toBe(false);
    expect(decision.stoppedAt).toBe(failedStep);
    expect(decision.completedSteps).toEqual(ROUTE_GUARD_ORDER.slice(0, failedIndex));
  });

  it("fails closed for unknown enums", () => {
    const checks = all("allow");
    checks.mode = "unknown";
    expect(evaluateRouteGuard({ checks })).toMatchObject({
      allowed: false,
      stoppedAt: "mode",
      reason: "未知状态，已安全阻断",
    });
  });

  it("executes network checks sequentially and never calls a later check after failure", async () => {
    const calls: string[] = [];
    const checks = Object.fromEntries(
      ROUTE_GUARD_ORDER.map((step) => [step, async () => {
        calls.push(step);
        return step === "rbac_capability" ? "deny" as const : "allow" as const;
      }]),
    ) as Parameters<typeof runRouteGuard>[0];
    const decision = await runRouteGuard(checks);
    expect(calls).toEqual(["session", "tenant_workspace", "rbac_capability"]);
    expect(decision.stoppedAt).toBe("rbac_capability");
  });

  it("turns transport errors into fail-closed unknown decisions", async () => {
    const checks = Object.fromEntries(
      ROUTE_GUARD_ORDER.map((step) => [step, async () => {
        if (step === "resource") throw new Error("network unavailable");
        return "allow" as const;
      }]),
    ) as Parameters<typeof runRouteGuard>[0];
    expect(await runRouteGuard(checks)).toMatchObject({
      allowed: false,
      stoppedAt: "resource",
      reason: "未知状态，已安全阻断",
    });
  });
});

describe("UI-101 shell policy", () => {
  it("renders navigation strictly from server capabilities", () => {
    expect(visibleShellNavigation(["command:read", "audit:read"]).map((item) => item.label)).toEqual([
      "Command",
      "Audit",
    ]);
  });

  it("blocks writes on small screens, stale data, offline, or unknown risk", () => {
    const safe = { connection: "live", freshness: "fresh", risk: "normal", compactViewport: false } as const;
    expect(writesAllowed(safe)).toBe(true);
    expect(writesAllowed({ ...safe, compactViewport: true })).toBe(false);
    expect(writesAllowed({ ...safe, freshness: "stale" })).toBe(false);
    expect(writesAllowed({ ...safe, connection: "offline" })).toBe(false);
    expect(writesAllowed({ ...safe, risk: "unknown" })).toBe(false);
  });
});
