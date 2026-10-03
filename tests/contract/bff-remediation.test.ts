import { describe, expect, it } from "vitest";
import { bffZodSchemas } from "../../packages/api-client/src/bff-gen/quantos-bff.zod";
import { openapi, operations, validateRequest, validateResponse } from "./http-contract.mjs";
import { validateFixture, loadFixture } from "./validate.mjs";
import { setupServer } from "msw/node";
import { handlers } from "./handlers";
const uuid="11111111-1111-4111-8111-111111111111";
const headers={cookie:"quantos_session=synthetic; quantos_csrf=synthetic-csrf-token",Origin:"http://localhost:3190", "X-CSRF-Token":"synthetic-csrf-token", "X-Request-Id":uuid,"Idempotency-Key":uuid,"If-Match":"draft-v3","content-type":"application/json"};
describe("A1 OpenAPI semantic remediation",()=>{
 it("preserves strategy maps and open extension data while rejecting forbidden fields",()=>{
  const value={...loadFixture("strategy/default.json"),parameters:{riskBudget:"0.01",nested:{symbol:"BTC"}},newOptionalPublicField:"preserved"};
  expect(validateFixture(value,{schema:"StrategyDraft"})).toEqual([]);
  expect(bffZodSchemas.StrategyDraft.parse(value)).toEqual(value);
  expect(bffZodSchemas.ReauthRequest.safeParse({challengeRef:uuid,actorId:uuid}).success).toBe(false);
 });
 it("all attached request/success examples validate against their operation schemas",async()=>{
  for(const [id,op]of operations) {
   if(op.requestBody) {
    const request=new Request('http://localhost:4010'+op.path.replace(/\{[^}]+\}/g,uuid),{method:op.method,headers:{...headers,"X-Reauth-Token-Ref":uuid},body:JSON.stringify(op.requestBody.content["application/json"].example)});
    const params=Object.fromEntries((op.parameters??[]).filter((p: {in?:string})=>p.in==="path").map((p: {name:string})=>[p.name,uuid]));
    expect((await validateRequest(id,request,params)).issues,id).toEqual([]);
   }
   for(const [status,response]of Object.entries(op.responses)) {
    const r=response as {content?:Record<string,{example:unknown}>,headers?:Record<string,unknown>};
    if(!/^2/.test(status)||!r.content?.["application/json"])continue;
    const result=Response.json(r.content["application/json"].example,{status:Number(status),headers:{"X-Correlation-Id":uuid,"Cache-Control":"no-store",ETag:"draft-v3"}});
    expect(await validateResponse(id,result),id).toEqual([]);
   }
  }
 });
 it("request contracts reject forged context, missing headers and unsafe sort/filter",async()=>{
  const make=(body:unknown,h:HeadersInit=headers)=>new Request('http://localhost:4010/v1/strategies/'+uuid+'/draft',{method:"PUT",headers:h,body:JSON.stringify(body)});
  expect((await validateRequest("saveStrategyDraft",make({files:{},parameters:{},actorId:uuid}),{strategyId:uuid})).status).toBe(422);
  expect((await validateRequest("saveStrategyDraft",make({files:{},parameters:{}},{cookie:"quantos_session=synthetic"}),{strategyId:uuid})).issues.length).toBeGreaterThan(0);
  expect((await validateRequest("listOrders",new Request('http://localhost:4010/v1/orders?sort=password:asc',{headers}))).status).toBe(422);
 });
 it("valid cookie succeeds; bearer-only and malformed writes fail through real MSW handlers",async()=>{
  const server=setupServer(...handlers);server.listen({onUnhandledRequest:"error"});
  try {
   expect((await fetch('http://localhost:4010/v1/session',{headers})).status).toBe(200);
   expect((await fetch('http://localhost:4010/v1/session',{headers:{authorization:'Bearer synthetic'}})).status).toBe(401);
   expect((await fetch('http://localhost:4010/v1/strategies/'+uuid+'/draft',{method:"PUT",headers,body:JSON.stringify({name:'invalid'})})).status).toBe(422);
  } finally {server.close();}
 });
 it("rejects provider response schema, header, status and sensitive-field drift",async()=>{
  expect((await validateResponse('getSession',Response.json({}, {headers:{"X-Correlation-Id":uuid,"Cache-Control":"no-store"}}))).length).toBeGreaterThan(0);
  expect((await validateResponse('getSession',Response.json(loadFixture('session/default.json')))).some((i:string)=>i.includes('header'))).toBe(true);
  expect((await validateResponse('getSession',Response.json({...loadFixture('session/default.json'),venueApiKey:'synthetic'},{headers:{"X-Correlation-Id":uuid,"Cache-Control":"no-store"}}))).some((i:string)=>i.includes('敏感'))).toBe(true);
  expect(openapi.info.version).toBe('1.4.0');
 });
 it("requires conflict version, rate retry and matching error correlation without debug extensions",async()=>{
  const envelope={code:'VERSION_CONFLICT',message:'stale',correlationId:uuid};
  const response=(body:unknown,status:number)=>Response.json(body,{status,headers:{'X-Correlation-Id':uuid,'Cache-Control':'no-store'}});
  expect((await validateResponse('saveStrategyDraft',response(envelope,409))).length).toBeGreaterThan(0);
  expect(await validateResponse('saveStrategyDraft',response({...envelope,currentVersion:'draft-v4'},409))).toEqual([]);
  expect((await validateResponse('mfaChallenge',response({...envelope,code:'RATE_LIMITED'},429))).length).toBeGreaterThan(0);
  expect(bffZodSchemas.ErrorEnvelope.safeParse({...envelope,debug:'internal'}).success).toBe(false);
  expect((await validateResponse('getSession',response({...envelope,code:'UNAUTHENTICATED',correlationId:'22222222-2222-4222-8222-222222222222'},401))).some((i:string)=>i.includes('mismatch'))).toBe(true);
 });
 it("mock enforces CSRF origin and preserves idempotent replay while rejecting changed payload",async()=>{
  const server=setupServer(...handlers);server.listen({onUnhandledRequest:"error"});
  const url='http://localhost:4010/v1/strategies/'+uuid+'/draft';
  const h={...headers,'Idempotency-Key':crypto.randomUUID()};const body=JSON.stringify({files:{},parameters:{}});
  try {
   expect((await fetch(url,{method:'PUT',headers:{...h,Origin:'https://attacker.invalid'},body})).status).toBe(403);
   const first=await fetch(url,{method:'PUT',headers:h,body});expect(first.status).toBe(200);
   const replay=await fetch(url,{method:'PUT',headers:h,body});expect(await replay.json()).toEqual(await first.json());
   expect((await fetch(url,{method:'PUT',headers:h,body:JSON.stringify({files:{},parameters:{changed:true}})})).status).toBe(409);
  }finally{server.close();}
 });
});
