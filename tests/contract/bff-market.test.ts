import { describe, it, expect } from "vitest";
import { bffZodSchemas } from "../../packages/api-client/src/bff-gen/quantos-bff.zod";
import { createBffClient } from "../../packages/api-client/src/bff";
import { validateFixture, loadFixture } from "./validate.mjs";
import { validateRequest, validateResponse } from "./http-contract.mjs";
const id="11111111-1111-4111-8111-111111111111";
const h={cookie:"quantos_session=fixture",origin:"http://localhost:3190","x-csrf-token":"fixture-csrf","x-request-id":id,"idempotency-key":id,"if-match":"watchlist-0","content-type":"application/json"};
describe("C12 market contract",()=>{
 it("validates exact decimals, authorized book, provenance and gaps through generated schemas",()=>{
  const q=loadFixture("market/venue-quote.json"),s=loadFixture("market/candle-series.json");
  expect(validateFixture(q,{schema:"VenueQuote"})).toEqual([]);expect(bffZodSchemas.VenueQuote.parse(q)).toEqual(q);
  expect(validateFixture(s,{schema:"CandleSeries"})).toEqual([]);expect(bffZodSchemas.CandleSeries.parse(s)).toEqual(s);
  for(const bad of [{...q,bid:100},{...q,executable:true},{...q,lastPrice:100},{...q,provenance:{...q.provenance,license:undefined}}])expect(bffZodSchemas.VenueQuote.safeParse(bad).success).toBe(false);
 });
 it("the generated client preserves market dimension query strings and response data",async()=>{
  const series=loadFixture("market/candle-series.json");let seen="";
  const client=createBffClient({baseUrl:"http://localhost:4010",fetch:async input=>{seen=(input as Request).url;return Response.json(series,{headers:{"x-correlation-id":id,"cache-control":"no-store"}});}});
  const r=await client.GET("/v1/markets/candles",{params:{query:{symbol:"BTC/USDT",venue:"binance",product:"spot",interval:"1m",timezone:"UTC"}}});
  expect(new URL(seen).searchParams.get("symbol")).toBe("BTC/USDT");expect(r.data).toEqual(series);
 });
 it("rejects forged watchlist context, missing CSRF/idempotency/version, and corrupted response",async()=>{
  for(const body of [{instrumentIds:[],actorId:id},{instrumentIds:["a","a"]},{instrumentIds:Array(101).fill("a")}]){
   const r=await validateRequest("saveWatchlist",new Request("http://localhost:4010/v1/markets/watchlist",{method:"PUT",headers:h,body:JSON.stringify(body)}));expect(r.issues.length).toBeGreaterThan(0);
  }
  for(const key of ["x-csrf-token","idempotency-key","if-match"]){const headers={...h};delete headers[key as keyof typeof h];expect((await validateRequest("saveWatchlist",new Request("http://localhost:4010/v1/markets/watchlist",{method:"PUT",headers,body:JSON.stringify({instrumentIds:[]})}))).issues.length).toBeGreaterThan(0);}
  const q=loadFixture("market/venue-quote.json");expect((await validateResponse("getVenueQuotes",Response.json({items:[{...q,lastPrice:5}]},{headers:{"x-correlation-id":id,"cache-control":"no-store"}}))).length).toBeGreaterThan(0);
 });
});
