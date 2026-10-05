export interface BffRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export class BffTransportError extends Error {
  constructor(readonly code: "TIMEOUT" | "CANCELLED" | "NETWORK", readonly outcomeUnknown: boolean) {
    super("BFF request could not be completed");
    this.name = "BffTransportError";
  }
}

/** Bounds both headers and JSON body. Writes are never retried here. */
export function createBffFetch(fetchImpl: typeof globalThis.fetch, options: BffRequestOptions = {}): typeof globalThis.fetch {
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError("BFF timeout must be positive and finite");
  return async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const write = !["GET", "HEAD", "OPTIONS"].includes(method);
    const controller = new AbortController();
    const signals = [options.signal, init?.signal, input instanceof Request ? input.signal : undefined].filter((s): s is AbortSignal => !!s);
    // Keep native stream cancellation connected after an SSE handshake returns.
    const fetchSignal = AbortSignal.any([controller.signal, ...signals]);
    let dispatched = false;
    let code: "TIMEOUT" | "CANCELLED" = "CANCELLED";
    let rejectAbort: (reason: BffTransportError) => void = () => {};
    const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
    const cancel = () => { controller.abort(); rejectAbort(new BffTransportError(code, write && dispatched)); };
    const timer = setTimeout(() => { code = "TIMEOUT"; cancel(); }, timeoutMs);
    for (const signal of signals) signal.addEventListener("abort", cancel, { once: true });
    try {
      if (signals.some(signal => signal.aborted)) cancel();
      if (controller.signal.aborted) return await aborted;
      const execute = async () => {
        dispatched = true;
        const response = await fetchImpl(input, { ...init, signal: fetchSignal });
        // SSE has its own reconnect/terminal policy; this deadline covers its handshake.
        if (response.headers.get("content-type")?.includes("text/event-stream")) return response;
        const bytes = await response.arrayBuffer();
        const buffered = new Response([204, 205, 304].includes(response.status) ? null : bytes, {
          status: response.status, statusText: response.statusText, headers: response.headers,
        });
        Object.defineProperty(buffered, "url", { value: response.url });
        return buffered;
      };
      return await Promise.race([execute(), aborted]);
    } catch (error) {
      if (error instanceof BffTransportError) throw error;
      throw new BffTransportError(controller.signal.aborted ? code : "NETWORK", write && dispatched);
    } finally {
      clearTimeout(timer);
      for (const signal of signals) signal.removeEventListener("abort", cancel);
    }
  };
}
