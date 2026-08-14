import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";

import { SseStreamReducer, consumeSse, type SseEventEnvelope, type ReducerAction } from "../src/sse.js";

/** Mock SSE 事件源：按请求 afterSequence 回放脚本化事件（含重复、乱序、断流、权限撤销）。 */
function makeServer(script: (afterSequence: number, requestCount: number) => (SseEventEnvelope | "close")[]): {
  url: () => string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  requests: string[];
} {
  const requests: string[] = [];
  let server: Server;
  let port = 0;
  let count = 0;
  return {
    requests,
    url: () => `http://127.0.0.1:${port}/stream`,
    start: () =>
      new Promise((resolve) => {
        server = createServer((req, res) => {
          const u = new URL(req.url ?? "/", "http://x");
          requests.push(u.search);
          if (u.searchParams.get("forbidden") === "1") {
            res.writeHead(403).end();
            return;
          }
          const after = Number(u.searchParams.get("afterSequence") ?? "0");
          count += 1;
          res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
          for (const item of script(after, count)) {
            if (item === "close") break;
            res.write(`data: ${JSON.stringify(item)}\n\n`);
          }
          res.end();
        });
        server.listen(0, "127.0.0.1", () => {
          port = (server.address() as AddressInfo).port;
          resolve();
        });
      }),
    stop: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

let seq = 0;
const env = (payload: Record<string, unknown>, eventId?: string): SseEventEnvelope => {
  seq += 1;
  return {
    streamId: "stream-1",
    sequence: seq,
    eventId: eventId ?? `evt-${seq}`,
    occurredAt: "2026-08-14T03:00:00Z",
    correlationId: "9a1c4e60-2d3b-4c5f-8a9e-1b2c3d4e5f60",
    payloadVersion: "v1",
    payload,
  };
};

const applied = (actions: ReducerAction[]) => actions.filter((a) => a.type === "apply").map((a) => (a as { type: "apply"; event: SseEventEnvelope }).event.sequence);

describe("SSE 断线续传 PoC（G0 #5）", () => {
  describe("SseStreamReducer", () => {
    it("重复与乱序事件被去重，序号严格递增应用", () => {
      seq = 0;
      const r = new SseStreamReducer();
      const e1 = env({ type: "progress" });
      const e2 = env({ type: "progress" });
      expect(r.accept(e1).type).toBe("apply");
      expect(r.accept(e2).type).toBe("apply");
      expect(r.accept(e2).type).toBe("duplicate"); // eventId 重放
      expect(r.accept(e1).type).toBe("duplicate"); // 乱序迟到
      expect(r.resumeAfter).toBe(2);
    });

    it("序号空洞触发 gap 而非应用", () => {
      seq = 0;
      const r = new SseStreamReducer();
      r.accept(env({ type: "a" }));
      const gap = r.accept(env({ type: "b" }));
      r.accept(env({ type: "c" })); // seq 3，越过 seq 2
      expect(gap.type).toBe("apply");
      expect(r.accept({ ...env({ type: "d" }), sequence: 99 }).type).toBe("gap");
    });

    it("权限撤销为终态，后续事件不再应用", () => {
      seq = 0;
      const r = new SseStreamReducer();
      r.accept(env({ type: "a" }));
      expect(r.accept(env({ type: "permission_revoked" })).type).toBe("closed");
      expect(r.isClosed).toBe(true);
      expect(r.accept(env({ type: "b" })).type).toBe("duplicate");
    });
  });

  describe("consumeSse（真实 HTTP SSE）", () => {
    it("断流后按 afterSequence 回补：无丢失、无重复副作用", async () => {
      seq = 0;
      const e1 = env({ type: "a" });
      const e2 = env({ type: "b" });
      const e3 = env({ type: "c" });
      const e4 = env({ type: "d" });
      const server = makeServer((after, count) => {
        if (count === 1) return [e1, e2, "close"]; // 第一次：1,2 后断流
        return [e1, e2, e3, e4]; // 重连：服务端从 1 重放全部（客户端须去重）
      });
      await server.start();
      try {
        const actions: ReducerAction[] = [];
        for await (const a of consumeSse({ url: server.url() })) {
          actions.push(a);
          if (applied(actions).length === 4) break;
        }
        expect(applied(actions)).toEqual([1, 2, 3, 4]); // 恰好一次、按序
        expect(server.requests.length).toBeGreaterThan(1); // 发生了续传重连
        expect(server.requests.at(-1)).toContain("afterSequence=2"); // 从最后确认序号回补
      } finally {
        await server.stop();
      }
    });

    it("序号空洞触发 gap 重连回补", async () => {
      seq = 0;
      const e1 = env({ type: "a" });
      const e2 = env({ type: "b" });
      const e3 = env({ type: "c" });
      const e4 = env({ type: "d" });
      const server = makeServer((after, count) => {
        if (count === 1) return [e1, e2, { ...e4, sequence: 4 }]; // 跳号发送 seq4（缺 seq3）
        return [e3, e4]; // 回补 3,4
      });
      await server.start();
      try {
        const actions: ReducerAction[] = [];
        for await (const a of consumeSse({ url: server.url() })) {
          actions.push(a);
          if (applied(actions).length === 4) break;
        }
        expect(actions.some((a) => a.type === "gap")).toBe(true);
        expect(applied(actions)).toEqual([1, 2, 3, 4]);
      } finally {
        await server.stop();
      }
    });

    it("权限撤销（permission_revoked 事件）终态关闭且不再重连", async () => {
      seq = 0;
      const e1 = env({ type: "a" });
      const revoked = env({ type: "permission_revoked" });
      const server = makeServer(() => [e1, revoked, env({ type: "after-revoke" })]);
      await server.start();
      try {
        const actions: ReducerAction[] = [];
        for await (const a of consumeSse({ url: server.url() })) actions.push(a);
        expect(applied(actions)).toEqual([1]);
        expect(actions.at(-1)).toEqual({ type: "closed", reason: "permission_revoked" });
        expect(server.requests.length).toBe(1); // 不重连
      } finally {
        await server.stop();
      }
    });

    it("HTTP 403 视为权限撤销终态", async () => {
      const server = makeServer(() => []);
      await server.start();
      try {
        const actions: ReducerAction[] = [];
        for await (const a of consumeSse({ url: `${server.url()}?forbidden=1` })) actions.push(a);
        expect(actions).toEqual([{ type: "closed", reason: "permission_revoked" }]);
      } finally {
        await server.stop();
      }
    });
  });
});
