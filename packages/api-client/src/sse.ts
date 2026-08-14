/**
 * SSE 断线续传 PoC（G0 未冻结项 #5）。
 *
 * 语义（执行计划 5.4/5.5 冻结项）：
 * - 事件信封：streamId/sequence/eventId/occurredAt/correlationId/payloadVersion/payload；
 * - 以 sequence 严格递增应用；eventId 去重；乱序迟到丢弃；
 * - 发现序号空洞（gap）即断开并按 afterSequence=最后确认序号 重连回补；
 * - 权限撤销（permission_revoked 或 403）即终态关闭，不再重连；
 * - 断线（网络/5xx/流结束）自动按 afterSequence 续传，不产生重复副作用。
 */

export interface SseEventEnvelope {
  streamId: string;
  sequence: number;
  eventId: string;
  occurredAt: string;
  correlationId: string;
  payloadVersion: string;
  payload: { type?: string; [k: string]: unknown };
}

export type ReducerAction =
  | { type: "apply"; event: SseEventEnvelope }
  | { type: "duplicate"; event: SseEventEnvelope }
  | { type: "gap"; expected: number; got: number }
  | { type: "closed"; reason: "permission_revoked" };

export class SseStreamReducer {
  private lastSequence: number;
  private readonly seenEventIds = new Set<string>();
  private closed = false;

  /** @param startAfter 重连起点：只应用 sequence 严格大于 startAfter 的事件 */
  constructor(startAfter = 0) {
    this.lastSequence = startAfter;
  }

  get resumeAfter(): number {
    return this.lastSequence;
  }

  get isClosed(): boolean {
    return this.closed;
  }

  accept(event: SseEventEnvelope): ReducerAction {
    if (this.closed || this.seenEventIds.has(event.eventId)) return { type: "duplicate", event };
    if (event.payload?.type === "permission_revoked") {
      this.seenEventIds.add(event.eventId);
      this.closed = true;
      return { type: "closed", reason: "permission_revoked" };
    }
    if (event.sequence <= this.lastSequence) return { type: "duplicate", event }; // 乱序迟到/重放
    if (event.sequence > this.lastSequence + 1) {
      return { type: "gap", expected: this.lastSequence + 1, got: event.sequence };
    }
    this.seenEventIds.add(event.eventId);
    this.lastSequence = event.sequence;
    return { type: "apply", event };
  }
}

/** 解析 SSE 字节流为事件信封（data: JSON，忽略注释/心跳行）。 */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEventEnvelope> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const data = raw
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data) yield JSON.parse(data) as SseEventEnvelope;
    }
  }
}

export interface ConsumeSseOptions {
  /** 支持 afterSequence query 的端点，例如 http://localhost:4010/v1/runs/:id/stream */
  url: string;
  reducer?: SseStreamReducer;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  /** 最大连续重连次数（防御无限循环；PoC 默认 10） */
  maxReconnects?: number;
}

/**
 * 消费 SSE：gap/断线自动按 afterSequence 重连回补；权限撤销终态关闭。
 * yield 每个 ReducerAction，调用方只对 type==="apply" 产生副作用。
 */
export async function* consumeSse(options: ConsumeSseOptions): AsyncGenerator<ReducerAction> {
  const { url, signal, fetchImpl = fetch, maxReconnects = 10 } = options;
  const reducer = options.reducer ?? new SseStreamReducer();
  let reconnects = 0;

  while (!reducer.isClosed) {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetchImpl(`${url}${sep}afterSequence=${reducer.resumeAfter}`, {
      headers: { accept: "text/event-stream" },
      signal,
    });
    if (res.status === 403) {
      yield { type: "closed", reason: "permission_revoked" };
      return;
    }
    if (!res.ok || !res.body) throw new Error(`SSE 连接失败：HTTP ${res.status}`);

    let gapDetected = false;
    for await (const event of parseSse(res.body)) {
      const action = reducer.accept(event);
      yield action;
      if (action.type === "gap") {
        gapDetected = true;
        break; // 立即重连回补，跳过残留旧事件
      }
      if (action.type === "closed") return;
    }
    if (reducer.isClosed) return;

    // 流结束或 gap：按 afterSequence 续传
    reconnects += 1;
    if (reconnects > maxReconnects) {
      throw new Error(`SSE 重连超过上限（${maxReconnects}），停止续传（gap=${gapDetected}）`);
    }
  }
}
