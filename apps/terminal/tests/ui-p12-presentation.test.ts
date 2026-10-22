import{describe,it,expect}from"vitest";
import{auditLocation,auditResourcePath,auditSummary,auditUtc,exportPresentation}from"../src/audit/presentation";
import type{ExportJob}from"../src/audit/gateway";
const id="aaaaaaaa-1111-4111-8111-111111111111";
describe("P12 resource and presentation boundaries",()=>{
 it("resolves canonical and legacy references to the same actual resource",()=>{expect(auditLocation(`/audit/${id}`,"")).toEqual({view:"audit",correlationId:id});expect(auditLocation("/audit",`?correlationId=${id}`)).toEqual({view:"audit",correlationId:id});expect(auditLocation(`/exports/${id}`,"")).toEqual({view:"exports",exportId:id});expect(auditResourcePath("audit",id)).toBe(`/audit/${id}`);});
 it.each(["/audit/nope","/audit/","/audit/../exports","/audit/aaaaaaaa%2f1111","/audit/"+id+"/extra","/settings/browser"])("rejects invalid resource path %s",path=>expect(()=>auditLocation(path,"")).toThrow());
 it.each([`?correlationId=${id}&correlationId=${id}`,`?exportId=${id}`,"?correlationId=not-a-uuid"])("rejects ambiguous or invalid audit query %s",q=>expect(()=>auditLocation("/audit",q)).toThrow());
 it("never permits a query to override a canonical reference",()=>{expect(()=>auditLocation(`/exports/${id}`,`?exportId=${id}`)).toThrow();expect(auditResourcePath("exports","javascript:alert(1)")).toBeUndefined();});
 it("does not infer global counts or cryptographic verification from an authorized chain",()=>{expect(auditSummary()).toMatchObject({objects:0,events:0,scopeComplete:false});expect(auditSummary(undefined,{correlationId:id,items:[],complete:false})).toMatchObject({scopeComplete:false});expect(auditSummary(undefined,{correlationId:id,items:[],complete:true,nextCursor:"tail"})).toMatchObject({scopeComplete:false});});
 it("formats UTC without changing original domain values",()=>{expect(auditUtc("2026-10-22T10:00:00+08:00")).toBe("2026-10-22 02:00:00.000 UTC");expect(auditUtc("invalid")).toBe("时间未提供");});
 it.each(["queued","generating","ready","cancel_requested","cancelled","expired","failed"] as const)("keeps %s distinct and blocks expired-retention handoff",status=>{const job={status,retentionUntil:"2026-10-23T00:00:00Z"} as ExportJob;const view=exportPresentation(job,Date.parse("2026-10-22T00:00:00Z"));expect(view.status).toBe(status);expect(view.downloadable).toBe(status==="ready");expect(exportPresentation(job,Date.parse("2026-10-24T00:00:00Z"))).toMatchObject({status:"expired",downloadable:false,cancellable:false});});
});
