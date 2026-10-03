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
import { SseContractError, SseStreamReducer, type SseEventEnvelope, type ReducerAction } from "./sse-contract.js";
export { SseContractError, SseStreamReducer, type SseEventEnvelope, type ReducerAction } from "./sse-contract.js";

/** 解析 SSE 字节流为事件信封（data: JSON，忽略注释/心跳行）。 */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEventEnvelope> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try { for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.search(/\r?\n\r?\n/)) >= 0) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + (buffer[idx] === "\r" ? 4 : 2));
      const data = raw
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart())
        .join("\n");
      if (data) {
        try { yield JSON.parse(data) as SseEventEnvelope; }
        catch (error) {
          if (error instanceof SyntaxError) throw new SseContractError("Invalid SSE JSON");
          throw error;
        }
      }
    }
  } } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export interface ConsumeSseOptions {
  /** 支持 afterSequence query 的端点，例如 http://localhost:4010/v1/runs/:id/stream */
  url: string;
  reducer?: SseStreamReducer;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  /** 最大总重连次数（防御无限循环；PoC 默认 10） */
  maxReconnects?: number;
  /** Base retry delay; capped exponential backoff, abort-aware. */
  retryDelayMs?: number;
}

async function retryDelay(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal?.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

/**
 * 消费 SSE：gap/断线自动按 afterSequence 重连回补；权限撤销终态关闭。
 * yield 每个 ReducerAction，调用方只对 type==="apply" 产生副作用。
 */
export async function* consumeSse(options: ConsumeSseOptions): AsyncGenerator<ReducerAction> {
  const { url, signal, fetchImpl = fetch, maxReconnects = 10, retryDelayMs = 250 } = options;
  const reducer = options.reducer ?? new SseStreamReducer();
  let reconnects = 0;

  while (!reducer.isClosed) {
    signal?.throwIfAborted();
    const streamUrl = new URL(url);
    streamUrl.searchParams.set("afterSequence", String(reducer.resumeAfter));
    let response: Response;
    try { response = await fetchImpl(streamUrl.toString(), {
      headers: { accept: "text/event-stream" },
      credentials: "include",
      cache: "no-store",
      signal,
    }); } catch (error) {
      signal?.throwIfAborted();
      if (++reconnects > maxReconnects) throw error;
      await retryDelay(Math.min(retryDelayMs * 2 ** (reconnects - 1), 4000), signal);
      continue;
    }
    const res = response;
    if (res.status === 401 || res.status === 403) {
      yield { type: "closed", reason: "permission_revoked" };
      return;
    }
    if (res.status >= 500) {
      await res.body?.cancel();
      if (++reconnects > maxReconnects) throw new Error(`SSE retry limit: HTTP ${res.status}`);
      await retryDelay(Math.min(retryDelayMs * 2 ** (reconnects - 1), 4000), signal);
      continue;
    }
    if (!res.ok || !res.body) throw new SseContractError(`SSE 连接失败：HTTP ${res.status}`);

    let gapDetected = false;
    try { for await (const event of parseSse(res.body)) {
      const action = reducer.accept(event);
      yield action;
      if (action.type === "gap") {
        gapDetected = true;
        break; // 立即重连回补，跳过残留旧事件
      }
      if (action.type === "closed") return;
    } } catch (error) {
      signal?.throwIfAborted();
      if (error instanceof SseContractError) throw error;
      // A transport/read failure resumes from the last acknowledged sequence.
    }
    if (reducer.isClosed) return;

    // 流结束或 gap：按 afterSequence 续传
    reconnects += 1;
    if (reconnects > maxReconnects) {
      throw new Error(`SSE 重连超过上限（${maxReconnects}），停止续传（gap=${gapDetected}）`);
    }
    await retryDelay(Math.min(retryDelayMs * 2 ** (reconnects - 1), 4000), signal);
  }
}
