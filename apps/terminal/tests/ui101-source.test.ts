import { afterEach, expect, it, vi } from "vitest";
import type { BffComponents } from "@sumalpha/api-client";
import { ui101CommandFixture } from "../src/command/fixture";
import { createCommandBffSource, createConfiguredCommandSource } from "../src/command/source";
import { loadGuardedCommand } from "../src/command/runtime";
import { sessionStore } from "../src/auth/flow";

const context = () => ({ ...structuredClone(ui101CommandFixture.session), capabilities: ["ops.read", "research.read"] });
export function summary(): BffComponents["schemas"]["CommandSummary"] {
  return { accountId: context().accountId, mode: "paper", sampledAt: new Date().toISOString(), asOf: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), revision: "sha256:" + "a".repeat(64), partial: false, dataFreshness: "fresh", riskPosture: "normal", systemHealth: "healthy", pendingApprovals: 0, failedRuns: 0, runningRuns: 0, openRiskAlerts: 0, orderSummary: null, priority: [], recentActivity: [], sources: ["research", "execution", "operations", "strategy"].map(domain => ({ domain: domain as "research", status: "ready", asOf: new Date().toISOString(), sourceHash: "sha256:" + "a".repeat(64) })), bounded: { sourceCount: 4, rowLimit: 2000, itemLimit: 50, truncated: false } };
}
function transport(options: { session?: unknown; context?: unknown; summary?: unknown; fail?: string; status?: number } = {}) {
  const paths: string[] = [];
  const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async input => {
    const request = new Request(input); const url = new URL(request.url); paths.push(url.pathname);
    expect(request.credentials).toBe("include");
    if (url.pathname === options.fail) return Response.json({ code: "REFUSED", message: "private-account-secret" }, { status: options.status ?? 403 });
    if (url.pathname === "/v1/session") return Response.json(options.session ?? context());
    if (url.pathname === "/v1/context") return Response.json(options.context ?? context());
    if (url.pathname === "/v1/command/summary") { expect(url.searchParams.get("accountId")).toBe(context().accountId); return Response.json(options.summary ?? summary()); }
    throw Error("unexpected path");
  });
  return { paths, fetchImpl, source: createCommandBffSource("http://bff.fixture", fetchImpl) };
}
afterEach(() => { sessionStore.clear(); vi.useRealTimers(); });
it("generated C01/context/C02 run in order and preserve zero/null without fixture fallback", async () => {
  const t = transport(); const r = await loadGuardedCommand(t.source);
  expect(t.paths).toEqual(["/v1/session", "/v1/context", "/v1/command/summary"]); expect(r.decision.completedSteps).toHaveLength(6);
  expect(r.projection?.summary?.runningRuns).toBe(0); expect(r.projection?.summary?.orderSummary).toBeNull(); expect(r.projection?.priority).toEqual([]);
});
it.each([
  ["session", { session: { ...context(), expiresAt: "2000-01-01T00:00:00Z" } }, 1],
  ["session", { session: { ...context(), mfaState: "challenged" } }, 1],
  ["tenant_workspace", { context: { ...context(), tenantId: crypto.randomUUID() } }, 2],
  ["tenant_workspace", { context: { ...context(), workspaceId: crypto.randomUUID() } }, 2],
  ["rbac_capability", { context: { ...context(), capabilities: [] } }, 2],
  ["resource", { context: { ...context(), accountId: crypto.randomUUID() } }, 2],
  ["mode", { context: { ...context(), mode: "shadow" } }, 2],
  ["mode", { session: { ...context(), mode: "assisted_live" }, context: { ...context(), mode: "assisted_live" } }, 2],
  ["data_freshness", { summary: { ...summary(), accountId: crypto.randomUUID() } }, 3],
  ["data_freshness", { summary: { ...summary(), expiresAt: "2000-01-01T00:00:00Z" } }, 3],
  ["data_freshness", { summary: { ...summary(), dataFreshness: "unavailable", asOf: null } }, 3],
] as const)("%s denial never publishes or requests subsequent data (%j)", async (step, options, count) => {
  const t = transport(options); const r = await loadGuardedCommand(t.source); expect(r.decision.stoppedAt).toBe(step); expect(r.projection).toBeUndefined(); expect(t.paths).toHaveLength(count);
});
it.each([401,403,404,503])("HTTP %i on later checks uses safe destination without disclosure", async status => {
  sessionStore.set({ subject: "old", establishedAt: "now", expiresIn: 300 });
  const t = transport({ fail: "/v1/command/summary", status }); const r = await loadGuardedCommand(t.source);
  expect(r.decision.destination).toBe(status === 401 ? "/login" : status === 503 ? "/maintenance" : "/unauthorized"); expect(r.projection).toBeUndefined(); expect(JSON.stringify(r)).not.toContain("secret");
  if (status === 401) expect(sessionStore.get()).toBeNull();
});
it("non-mock misconfiguration refuses without issuing any request or using fixture", async () => {
  const fetchImpl = vi.fn<typeof fetch>(); const r = await loadGuardedCommand(createConfiguredCommandSource(false, undefined, fetchImpl)); expect(r.decision.allowed).toBe(false); expect(fetchImpl).not.toHaveBeenCalled();
});
it("explicit mock is isolated and fresh guard runs can recover after refusal", async () => {
  expect((await loadGuardedCommand(createConfiguredCommandSource(true))).contractMode).toBe("mocked");
  expect((await loadGuardedCommand(transport({ fail: "/v1/session", status: 401 }).source)).decision.allowed).toBe(false);
  expect((await loadGuardedCommand(transport().source)).decision.allowed).toBe(true);
});
it("stale server data stays stale, unknown risk stays unknown, caller cannot mutate cached facts", async () => {
  const t = transport({ summary: { ...summary(), dataFreshness: "stale", riskPosture: "unknown", runningRuns: null } }); const r = await loadGuardedCommand(t.source);
  expect(r.projection?.freshness.state).toBe("stale"); expect(r.projection?.risk.posture).toBe("unknown");
  r.projection!.session.capabilities.length = 0; expect((await t.source.loadProjection()).session.capabilities.length).toBeGreaterThan(0);
});
it("cancel before dispatch blocks, and expiry after guards prevents cached projection publication", async () => {
  const controller = new AbortController(); controller.abort(); const fetchImpl = vi.fn<typeof fetch>();
  expect((await loadGuardedCommand(createCommandBffSource("http://bff.fixture", fetchImpl, controller.signal))).decision.allowed).toBe(false); expect(fetchImpl).not.toHaveBeenCalled();
  vi.useFakeTimers(); const t = transport(); expect((await loadGuardedCommand(t.source)).decision.allowed).toBe(true);
  vi.advanceTimersByTime(60_001); await expect(t.source.loadProjection()).rejects.toThrow("expired");
});
it("projection-load failure returns a bounded safe error", async () => {
  const r = await loadGuardedCommand({ contractMode: "integrated", check: async () => "allow", loadProjection: async () => { throw Error("private-payload"); } });
  expect(r.decision.destination).toBe("/offline"); expect(JSON.stringify(r)).not.toContain("private");
});
