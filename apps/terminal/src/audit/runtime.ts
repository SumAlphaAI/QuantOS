import {bffZodSchemas, createBffClient, type BffRequestOptions} from "@sumalpha/api-client";
import {completeSecurityMfa, completeRecentAuth} from "../auth/bff";
import type {RouteContext} from "../auth/route-access";
import {AuditGatewayError, searchAuditEvents, loadEvidenceChain, createControlledExport, cancelControlledExport, loadExportStatus, getControlledExportDownload, type AuditSearch, type ExportRequest, type ExportJob, type AuditEventPage, type EvidenceChainPage, type ExportDownloadMetadata} from "./gateway";
const uuid = (value: string) => bffZodSchemas.UUID.parse(value);
const authority = (c: RouteContext) => JSON.stringify([c.actorId,c.tenantId,c.workspaceId,c.accountId,c.mode,c.environment,c.mfaState,[...new Set(c.capabilities)].sort()]);
export type AuditRuntimeOptions = {origin: string; fetchImpl?: typeof fetch; authorize: () => void; csrf: () => string; online: () => boolean; width: () => number; now?: () => number; timeoutMs?: number};
/** Memory only. Closing a route aborts reads, MFA and mutations and discards all intents. */
export function createAuditRuntime(config: AuditRuntimeOptions) {
  const transport = config.fetchImpl ?? fetch, now = config.now ?? Date.now, lifetime = new AbortController();
  const options: BffRequestOptions = {signal: lifetime.signal, timeoutMs: config.timeoutMs ?? 15000};
  let context: RouteContext | undefined, busy = false, retryAt = 0, query: AuditSearch | undefined, page: AuditEventPage | undefined, chain: EvidenceChainPage | undefined, job: ExportJob | undefined;
  let uncertain: string | undefined, boundAuthority:string|undefined, boundDeadline=Infinity;
  const keys = new Map<string,string>(), searchCursors = new Set<string>(), chainCursors = new Set<string>();
  const fail = (status: number, message = "访问条件已变化，请重新验证。") => {throw new AuditGatewayError(message,"auditRuntime",status);};
  const localPolicyFailures=new WeakSet<object>();
  const policyFail=(status:number,message?:string):never=>{const error=new AuditGatewayError(message??"当前操作条件未满足。","auditRuntime",status);localPolicyFailures.add(error);throw error;};
  function clear(){context=undefined;page=undefined;chain=undefined;job=undefined;query=undefined;keys.clear();uncertain=undefined;searchCursors.clear();chainCursors.clear();}
  const authorize=()=>{try{config.authorize();}catch(error){clear();throw error;}};
  function guard(write = false, highRisk = false) {
    try {
      authorize();
      if (lifetime.signal.aborted || !config.online() || !context) fail(403);
      if (!Number.isFinite(now()) || now() >= Date.parse(context!.expiresAt)) fail(401);
      if (!context!.capabilities.includes("audit:read")) fail(403);
    }catch(error){clear();throw error;}
    if(write&&context!.mode==="assisted_live")policyFail(403,"当前模式仅支持共同审计查询，导出尚未开放。");
    if(write&&!context!.capabilities.includes("audit:export"))policyFail(403);
    if (write && !config.csrf()) policyFail(403);
    if (highRisk && config.width() < 768) policyFail(403,"小屏仅支持审计查询和已授权下载。");
    if (write && now() < retryAt) fail(429,"请求过于频繁，请等待后显式重试。");
    return context!;
  }
  async function exclusive<T>(run: () => Promise<T>): Promise<T> {
    if (busy) throw Error("已有请求处理中。");busy = true;
    try {return await run();} catch (error) {
      const e = error as {status?:number;retryAfter?:number};
      if(e.status===401||(e.status===403&&!localPolicyFailures.has(error as object)))clear();
      if (e.status === 429 && retryAt <= now()) retryAt = now() + (Number.isFinite(e.retryAfter) && e.retryAfter! > 0 ? Math.min(e.retryAfter!,3600) : 30)*1000;
      throw error;
    } finally {busy = false;}
  }
  function rows<T extends {eventId:string;retentionUntil:string}>(items:T[], maximum:number) {
    if (items.length > maximum || new Set(items.map(item=>item.eventId)).size !== items.length || items.some(item=>Date.parse(item.retentionUntil)<=now())) fail(410,"审计记录已过期或分页无效，请重新搜索。");
  }
  function cursor(next: string | undefined, current: string | undefined, seen: Set<string>) {
    if (next && (next === current || seen.has(next))) fail(502,"服务端分页游标无效，请重新搜索。");
  }
  async function mutation(intent: string, code: string, run: (key:string,grant:string)=>Promise<ExportJob>) {
    guard(true,true);await identity();guard(true,true);
    if (uncertain && uncertain !== intent) fail(409,"上次请求结果未知，请先用原内容显式重试确认。");
    if (!/^\d{6}$/.test(code)) fail(422,"请输入六位 MFA 验证码。");
    if (!keys.has(intent)) keys.set(intent,crypto.randomUUID());
    const challenge = await completeSecurityMfa(config.origin,code,config.csrf(),transport,options);guard(true,true);
    if (challenge.status !== "verified") fail(422,"MFA 验证未通过。");
    const grant = await completeRecentAuth(config.origin,challenge.challengeRef,config.csrf(),transport,options);guard(true,true);
    if (Date.parse(grant.expiresAt)<=now()) fail(401);
    try {const result = await run(keys.get(intent)!,grant.reauthTokenRef);guard(true,true);job = result;keys.delete(intent);uncertain = undefined;return structuredClone(result);}
    catch (error) {
      const e=error as {outcomeUnknown?:boolean;status?:number};
      if (context && !lifetime.signal.aborted && (e.outcomeUnknown || e.status===undefined || e.status>=500 || e.status>=200&&e.status<300)) {uncertain=intent;e.outcomeUnknown=true;}
      throw error;
    }
  }
  async function identity() {
    try {
      if (!config.origin) fail(503,"审计服务未配置。");
      const client = createBffClient({baseUrl:config.origin,fetch:transport,...options});
      const read = async (path:"/v1/session"|"/v1/context") => {
        const r=await client.GET(path,{cache:"no-store"});
        if (!r.data) fail(r.response.status);
        const checked=bffZodSchemas.SessionContext.safeParse(r.data);
        if(!checked.success)fail(403,"审计身份响应无效，请重新核对访问权限。");
        return checked.data!;
      };
      const session=await read("/v1/session");authorize();
      const current=await read("/v1/context");authorize();
      if (lifetime.signal.aborted || authority(session)!==authority(current) || boundAuthority!==undefined&&boundAuthority!==authority(current) || current.mfaState==="challenged" || !["research","paper","shadow","assisted_live"].includes(current.mode)) fail(403);
      boundAuthority??=authority(current);boundDeadline=Math.min(boundDeadline,Date.parse(session.expiresAt),Date.parse(current.expiresAt));
      context={...current,expiresAt:new Date(boundDeadline).toISOString()};guard();
      return structuredClone(context);
    }catch(error){const status=(error as {status?:number}).status;if(status===401||status===403)clear();throw error;}
  }
  return {
    assertCurrent() {guard();},
    get deadline() {return Math.min(context ? Date.parse(context.expiresAt) : Infinity,...(page?.items??[]).map(i=>Date.parse(i.retentionUntil)),...(chain?.items??[]).map(i=>Date.parse(i.retentionUntil)));},
    get retryAt() {return retryAt;},
    get uncertain() {return Boolean(uncertain);},
    load:identity,
    search(input: AuditSearch = {}, more = false) {return exclusive(async()=>{
      guard();
      if (more && (!query || !page?.nextCursor || searchCursors.size>=49)) fail(422);
      const selected:AuditSearch=more ? {...query,cursor:page!.nextCursor} : {...input,cursor:undefined,pageSize:input.pageSize??25};
      for (const key of ["correlationId","causationId"] as const) if (selected[key]) uuid(selected[key]!);
      if (!Number.isInteger(selected.pageSize) || selected.pageSize!<1 || selected.pageSize!>200) fail(422);
      if (selected.startAt && !Number.isFinite(Date.parse(selected.startAt)) || selected.endAt && !Number.isFinite(Date.parse(selected.endAt)) || selected.startAt && selected.endAt && Date.parse(selected.startAt)>Date.parse(selected.endAt)) fail(422,"审计时间范围无效。");
      const result=await searchAuditEvents(config.origin,selected,transport,options);guard();rows(result.items,selected.pageSize!);
      cursor(result.nextCursor,selected.cursor,more?searchCursors:new Set());
      if (more) searchCursors.add(selected.cursor!); else {searchCursors.clear();chain=undefined;}
      query={...selected,cursor:undefined};page=result;return structuredClone(result);
    });},
    evidence(correlationId: string, more = false) {return exclusive(async()=>{
      guard();uuid(correlationId);
      if (more && (chain?.correlationId!==correlationId || !chain.nextCursor || chainCursors.size>=19)) fail(422);
      const current=more?chain!.nextCursor:undefined;
      const result=await loadEvidenceChain(config.origin,correlationId,{pageSize:100,cursor:current},transport,options);guard();rows(result.items,100);cursor(result.nextCursor,current,more?chainCursors:new Set());
      if (result.complete && result.nextCursor) fail(502,"证据链分页完成标记无效。");
      const items=more?[...chain!.items,...result.items]:result.items;rows(items,2000);
      if (more) chainCursors.add(current!);else chainCursors.clear();chain={...result,items};return structuredClone(chain);
    });},
    create(input: ExportRequest, code: string) {return exclusive(async()=>{
      const body=bffZodSchemas.ExportRequest.strict().parse(input);
      if (body.scope.startAt && body.scope.endAt && Date.parse(body.scope.startAt)>Date.parse(body.scope.endAt)) fail(422);
      const intent=JSON.stringify(["create",body]);
      return mutation(intent,code,(key,grant)=>createControlledExport(config.origin,body,key,config.csrf(),grant,transport,options));
    });},
    status(id: string) {return exclusive(async()=>{guard();if(context!.mode==="assisted_live")policyFail(403);uuid(id);const result=await loadExportStatus(config.origin,id,transport,options);guard();job=result;const intent=JSON.stringify(["cancel",id]);if(uncertain===intent&&["cancelled","cancel_requested"].includes(result.status)){uncertain=undefined;keys.delete(intent);}return structuredClone(result);});},
    cancel(id: string, code: string) {return exclusive(async()=>{
      guard(true,true);uuid(id);
      const latest=await loadExportStatus(config.origin,id,transport,options);guard(true,true);job=latest;
      const intent=JSON.stringify(["cancel",id]);
      if (uncertain===intent && ["cancelled","cancel_requested"].includes(latest.status)) {uncertain=undefined;keys.delete(intent);return structuredClone(latest);}
      if (!job || job.exportId!==id || !["queued","generating","ready"].includes(job.status) || Date.parse(job.retentionUntil)<=now()) fail(409,"该作业当前不可取消，请查询最新状态。");
      return mutation(intent,code,(key,grant)=>cancelControlledExport(config.origin,id,key,config.csrf(),grant,transport,options));
    });},
    download(id: string, deliver: (metadata:ExportDownloadMetadata)=>void) {return exclusive(async()=>{
      guard(true);uuid(id);
      if (!job || job.exportId!==id || job.status!=="ready" || Date.parse(job.retentionUntil)<=now()) fail(410,"文件尚不可下载或已过期，请查询状态。");
      const metadata=await getControlledExportDownload(config.origin,id,transport,options);guard(true);
      if (Date.parse(metadata.expiresAt)<=now() || Date.parse(metadata.retentionUntil)>Date.parse(job!.retentionUntil)) fail(410);
      // A transient handoff; the URL is never returned as component state or history.
      deliver(metadata);
      return {sha256:metadata.sha256,sizeBytes:metadata.sizeBytes,auditRef:metadata.auditRef};
    });},
    close() {lifetime.abort();clear();boundAuthority=undefined;boundDeadline=Infinity;},
  };
}
export type AuditRuntime = ReturnType<typeof createAuditRuntime>;
