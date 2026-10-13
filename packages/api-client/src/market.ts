import { bffZodSchemas } from "./bff-gen/quantos-bff.zod.js";
import type { components } from "./bff-gen/quantos-bff.js";
import type { SseEventEnvelope } from "./sse-contract.js";

export interface MarketDimensions {
  symbol: string;
  venue: "binance" | "coinbase";
  product: "spot";
  interval: "1m" | "5m" | "15m" | "1h" | "4h" | "1D" | "1W";
  timezone: "UTC" | "Asia/Shanghai";
}
export type CandleSeries = components["schemas"]["CandleSeries"];
export const marketCacheKey = (d: MarketDimensions, authorityScope: string): string =>
  JSON.stringify([authorityScope, d.symbol, d.venue, d.product, d.interval, d.timezone]);

/** Retain a frozen chart on disconnect; recovery replaces the whole licensed series. */
export class MarketSeriesRecovery {
  private sequence = 0;
  private streamId: string | undefined;
  private series: CandleSeries | undefined;
  private closed = false;
  constructor(readonly dimensions: MarketDimensions, readonly authorityScope: string) { this.dimensions = Object.freeze({ ...dimensions }); }
  get snapshot(): CandleSeries | undefined { return this.series && structuredClone(this.series); }
  get cursor(): { afterSequence: number; streamId?: string } {
    return { afterSequence: this.sequence, ...(this.streamId ? { streamId: this.streamId } : {}) };
  }
  reset(): void { this.sequence = 0; this.streamId = undefined; }
  revoke(): void { this.closed = true; this.series = undefined; this.reset(); }
  apply(raw: SseEventEnvelope): "applied" | "ignored" | "reset" {
    if (this.closed) throw new Error("market permission revoked");
    const e = bffZodSchemas.StreamEvent.parse(raw);
    if (e.payload.type === "permission_revoked") { this.revoke(); return "reset"; }
    if (e.payload.type === "market_reset") { this.reset(); return "reset"; }
    const s = bffZodSchemas.CandleSeries.parse(e.payload);
    const d = this.dimensions;
    if (s.canonicalSymbol !== d.symbol || s.venue !== d.venue || s.productType !== d.product ||
        s.interval !== d.interval || s.timezone !== d.timezone || s.replaceSeries !== true ||
        s.sequence !== e.sequence || this.streamId && e.streamId !== this.streamId) {
      throw new Error("market stream dimensions changed; refresh required");
    }
    if (e.sequence <= this.sequence) return "ignored";
    // Each event carries a complete bounded snapshot, so sequence jumps replace, never concatenate.
    this.series = structuredClone(s); this.sequence = e.sequence; this.streamId = e.streamId;
    return "applied";
  }
  url(base: string): string {
    const u = new URL("/v1/markets/candles/stream", base);
    for (const [k, v] of Object.entries(this.dimensions)) u.searchParams.set(k, v);
    for (const [k, v] of Object.entries(this.cursor)) u.searchParams.set(k, String(v));
    return u.toString();
  }
}
