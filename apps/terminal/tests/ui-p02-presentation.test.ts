import { describe, expect, it, vi } from "vitest";
import { ui101CommandFixture } from "../src/command/fixture";
import { commandItemPath, commandNavigationCapabilities, parseCommandLayout, presentCommand } from "../src/command/presentation";
import { commandView } from "../src/command/gateway";
import { createCommandBffSource } from "../src/command/source";
import { loadGuardedCommand } from "../src/command/runtime";
import type { CommandProjection } from "../src/command/model";

function projection(): CommandProjection { return structuredClone(ui101CommandFixture); }
function data() { const p = projection(); const value = p.summary!; value.sampledAt = new Date().toISOString(); value.asOf = value.sampledAt; value.expiresAt = new Date(Date.parse(value.sampledAt) + 30_000).toISOString(); for (const s of value.sources) s.asOf = value.sampledAt; return value; }

describe("P02 source authority, visibility and presentation", () => {
  it("crops unauthorized cards, rows, links and fake badges even if a malformed server leaks values", () => {
    const p = projection(); p.session.capabilities = ["ops.read"];
    const v = presentCommand(p); expect(v.runningRuns).toBeNull(); expect(v.orders).toBeNull(); expect(v.pendingApprovals).toBeNull(); expect(v.risk).toBe("unknown"); expect(v.priority.map(i => i.kind)).toEqual(["alert"]);
    expect(v.sources.map(s => s.domain)).toEqual(["operations"]); expect(v.activity.every(i => i.kind === "alert")).toBe(true);
  });
  it("distinguishes a true zero from missing/forbidden values and preserves null rather than fixture fallbacks", () => {
    const p = projection(); p.summary!.openRiskAlerts = 0; p.summary!.runningRuns = null; p.summary!.orderSummary = null;
    expect(presentCommand(p)).toMatchObject({ openRiskAlerts: 0, runningRuns: null, orders: null });
    p.summary = undefined; expect(presentCommand(p)).toMatchObject({ priority: [], activity: [], openRiskAlerts: null, orders: null, runningRuns: null });
  });
  it("masks unavailable sources without hiding the distinction from zero or changing their timestamps", () => {
    const p = projection(); p.summary!.sources.find(s => s.domain === "research")!.status = "unavailable";
    p.summary!.sources.find(s => s.domain === "strategy")!.status = "forbidden";
    const v = presentCommand(p); expect(v.runningRuns).toBeNull(); expect(v.priority.map(i => i.kind)).not.toContain("run"); expect(v.sources.map(s => s.domain)).not.toContain("strategy");
    expect(v.sources.find(s => s.domain === "execution")?.asOf).toBe(p.summary!.sources[1].asOf);
  });
  it("ignores legacy fixture business rows instead of using them as fallback facts", () => {
    const p = projection(); p.summary!.priority = []; p.summary!.recentActivity = [];
    p.activity[0].actor = "untrusted legacy actor"; p.priority[0].summary = "untrusted legacy item";
    const v = presentCommand(p); expect(v.priority).toEqual([]); expect(v.activity).toEqual([]); expect(JSON.stringify(v)).not.toContain("untrusted legacy");
  });
  it("computes age from the server sampling timestamps, independent of the client clock", () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    try { expect(presentCommand(projection()).ageAtSampleMs).toBe(2000); } finally { vi.useRealTimers(); }
  });
  it("permits only kind/id-bound relative resource links", () => {
    const item = projection().summary!.priority[0]; expect(commandItemPath(item)).toBe(item.objectRef);
    for (const objectRef of ["https://evil.example", "//evil.example", item.objectRef + "?token=private", "/orders/" + item.id, "/approvals/11111111-1111-4111-8111-111111111111"]) expect(commandItemPath({ ...item, objectRef })).toBeUndefined();
  });
  it("adds only known read navigation aliases, without fabricating action capabilities", () => {
    expect(commandNavigationCapabilities(["ops.read"])).toEqual(["ops.read"]);
    const normalized = commandNavigationCapabilities(["execution.operate", "strategy.approve"]); expect(normalized).toContain("order:read"); expect(normalized).toContain("approval:read"); expect(normalized).not.toContain("research.write");
  });
  it.each([null, "bad json", '{"collapsed":"true","compact":1}', '{"theme":"light"}'])("optional invalid layout %s cannot alter authorization", raw => expect(parseCommandLayout(raw)).toEqual({ collapsed: false, compact: false }));
  it("persists only boolean layout preferences, never imported capability/account fields", () => expect(parseCommandLayout('{"collapsed":true,"compact":false,"capabilities":["admin:read"],"account":"secret"}')).toEqual({ collapsed: true, compact: false }));
});

describe("P02 validated snapshot boundary", () => {
  it("accepts current valid facts and rejects cross-mode orders and forged resource links", () => {
    const v = data(); expect(commandView(v, v.accountId, "paper")).toEqual(v);
    expect(() => commandView({ ...v, orderSummary: { ...v.orderSummary!, mode: "shadow" } }, v.accountId, "paper")).toThrow("order mode");
    expect(() => commandView({ ...v, priority: [{ ...v.priority[0], objectRef: "/orders/" + v.priority[0].id }] }, v.accountId, "paper")).toThrow("resource");
  });
  it.each(["research", "strategy", "operations", "execution"])("refuses inconsistent %s source metrics", domain => {
    const v = data(); v.sources.find(s => s.domain === domain)!.status = "unavailable"; v.partial = true;
    expect(() => commandView(v, v.accountId, "paper")).toThrow();
  });
  it("requires true partial state and metadata for ready sources", () => {
    const v = data(); expect(() => commandView({ ...v, expiresAt: new Date(Date.parse(v.sampledAt) + 31_000).toISOString() }, v.accountId, "paper")).toThrow("lease");
    expect(() => commandView({ ...v, partial: true }, v.accountId, "paper")).toThrow("partial");
    v.sources[0].sourceHash = null; expect(() => commandView(v, v.accountId, "paper")).toThrow("metadata");
    v.sources[0].sourceHash = "sha256:" + "b".repeat(64); v.sources[0].asOf = new Date(Date.now() - 60_000).toISOString(); expect(() => commandView(v, v.accountId, "paper")).toThrow("metadata");
    v.sources[0].asOf = new Date(Date.now() + 10_000).toISOString(); expect(() => commandView(v, v.accountId, "paper")).toThrow("metadata");
  });
  it("bounds the mounted projection by the earlier of session and context expiry", async () => {
    const now = Date.now(), p = projection(), calls: string[] = [];
    const transport = vi.fn<typeof fetch>().mockImplementation(async input => {
      const path = new URL(new Request(input).url).pathname; calls.push(path);
      return Response.json(path === "/v1/command/summary" ? data() : { ...p.session, expiresAt: new Date(now + (path === "/v1/session" ? 2000 : 300_000)).toISOString() });
    });
    const result = await loadGuardedCommand(createCommandBffSource("http://bff.fixture", transport));
    expect(result.decision.allowed).toBe(true); expect(result.projection!.session.expiresAt).toBe(new Date(now + 2000).toISOString()); expect(calls).toHaveLength(3);
  });
});
