import {it,expect} from "/Users/anray/Documents/project/SumAlpha/QuantOS/node_modules/vitest/dist/index.js";
import {getControlledExportDownload,searchAuditEvents,AuditGatewayError} from "/Users/anray/Documents/project/SumAlpha/QuantOS/apps/terminal/src/audit/gateway.ts";
import {writeFileSync} from "node:fs";
it("records malformed success responses accepted by audit gateway",async()=>{
 const invalid={exportId:"11111111-2222-4333-8444-555555555555",downloadUrl:"https://downloads.invalid/test",expiresAt:"2000-01-01T00:00:00Z",watermarked:false};
 const fetchImpl=(async()=>new Response(JSON.stringify(invalid),{headers:{"content-type":"application/json"}})) as typeof fetch;
 const result=await getControlledExportDownload("https://bff.example",invalid.exportId,fetchImpl);expect(result).toEqual(invalid);
 const page=await searchAuditEvents("https://bff.example",{},(async()=>new Response(JSON.stringify({items:[{redactionApplied:false,redactedPayload:{testValue:"SYNTHETIC_PRIVATE_VALUE_007"}}]}),{headers:{"content-type":"application/json"}})) as typeof fetch);expect(page.items[0].redactionApplied).toBe(false);
 const net=await getControlledExportDownload("https://bff.example",invalid.exportId,(async()=>{throw new Error("transport test")}) as typeof fetch).catch(e=>e);expect(net).not.toBeInstanceOf(AuditGatewayError);
 writeFileSync("/Users/anray/Documents/project/SumAlpha/QuantOS/docs/audit/evidence/bff-fe-007-review-20261006/gateway-probes.json",JSON.stringify({malformedDownloadAccepted:result,malformedAuditPageAccepted:page,networkErrorType:net.constructor.name},null,2)+"\n");
});
