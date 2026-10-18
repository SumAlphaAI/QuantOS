import { it, expect } from "vitest";
import { MarketSeriesRecovery, marketCacheKey, type MarketDimensions } from "../src/market.js";
import type { SseEventEnvelope } from "../src/sse-contract.js";
import {readFileSync} from "node:fs";
const series=JSON.parse(readFileSync(new URL("../../../tests/contract/fixtures/market/candle-series.json",import.meta.url),"utf8"));
const d:MarketDimensions={symbol:"BTC/USDT",venue:"binance",product:"spot",interval:"1m",timezone:"UTC"};
const event=(sequence=1):SseEventEnvelope=>({streamId:"11111111-1111-4111-8111-111111111111",sequence,eventId:"22222222-2222-4222-8222-222222222222",occurredAt:"2026-10-13T00:00:00Z",correlationId:"33333333-3333-4333-8333-333333333333",payloadVersion:"v1",payload:{...series,sequence}});
it("replaces a frozen series after gaps and ignores duplicate/out-of-order delivery",()=>{
 const r=new MarketSeriesRecovery(d,"tenant:actor:workspace:account:paper");expect(r.apply(event())).toBe("applied");expect(r.apply(event())).toBe("ignored");const next=event(10);next.payload={...next.payload,ohlcv:[],gaps:[]};expect(r.apply(next)).toBe("applied");expect(r.snapshot?.ohlcv).toEqual([]);expect(r.apply(event(2))).toBe("ignored");expect(r.cursor.afterSequence).toBe(10);expect(new URL(r.url("http://localhost:4010")).searchParams.get("streamId")).toBe(event().streamId);
});
it("cache keys cover authority and every market dimension",()=>{
 const key=marketCacheKey(d,"a");for(const changed of [{...d,symbol:"ETH/USDT"},{...d,venue:"coinbase" as const},{...d,interval:"5m" as const},{...d,timezone:"Asia/Shanghai" as const}])expect(marketCacheKey(changed,"a")).not.toBe(key);expect(marketCacheKey(d,"b")).not.toBe(key);
});
it("rejects a different venue, interval, stream or corrupt payload before cache mutation",()=>{
 const r=new MarketSeriesRecovery(d,"a");r.apply(event());const original=r.snapshot;
 for(const e of [{...event(2),streamId:"44444444-4444-4444-8444-444444444444"},{...event(2),payload:{...event(2).payload,venue:"coinbase"}},{...event(2),payload:{...event(2).payload,interval:"5m"}},{...event(2),payload:{...event(2).payload,sequence:3}}]){expect(()=>r.apply(e)).toThrow();expect(r.snapshot).toEqual(original);}
});
it("reset freezes the chart and discards cursor; permission revocation clears it permanently",()=>{
 const r=new MarketSeriesRecovery(d,"a");r.apply(event());expect(r.apply({...event(2),payload:{type:"market_reset"}})).toBe("reset");expect(r.snapshot).toBeDefined();expect(r.cursor.afterSequence).toBe(0);r.apply(event(5));expect(r.apply({...event(6),payload:{type:"permission_revoked"}})).toBe("reset");expect(r.snapshot).toBeUndefined();expect(()=>r.apply(event(7))).toThrow("permission revoked");
});
it("rejects schema-valid cross-resource provenance before mutating series or cursor",()=>{
 const r=new MarketSeriesRecovery(d,"a");r.apply(event());const original=r.snapshot,cursor=r.cursor;
 for(const payload of [{...series,instrumentId:"coinbase:spot:BTC/USDT",sequence:2},{...series,provenance:{...series.provenance,venue:"coinbase"},sequence:2},{...series,provenance:{...series.provenance,license:" "},sequence:2}]){
  expect(()=>r.apply({...event(2),payload})).toThrow();expect(r.snapshot).toEqual(original);expect(r.cursor).toEqual(cursor);
 }
});
it("rejects lossy unsafe integer sequences before cache mutation",()=>{
 const r=new MarketSeriesRecovery(d,"a");expect(()=>r.apply(event(Number.MAX_SAFE_INTEGER+1))).toThrow();expect(r.cursor.afterSequence).toBe(0);expect(r.snapshot).toBeUndefined();
});
