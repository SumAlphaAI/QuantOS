import {bffZodSchemas, createBffClient} from "@sumalpha/api-client";
import type {RouteContext} from "../auth/route-access";
import {DraftBuffer} from "./gateway";
import {draftDiff, parseDraftContent, type DraftContent, type StrategyDraft, type StrategySummary} from "./policy";
export class StrategyError extends Error {
 constructor(readonly status: number, readonly correlationId?: string) {super("Strategy request could not be completed");}
}
const authority = (c: RouteContext) => JSON.stringify([c.actorId,c.tenantId,c.workspaceId,c.accountId,c.mode,c.environment,c.mfaState,[...new Set(c.capabilities)].sort()]);
export function createStrategyRuntime(config: {origin: string; authorize: () => void; csrf: () => string; online: () => boolean; fetchImpl?: typeof fetch; now?: () => number; timeoutMs?: number}) {
 const now = config.now ?? Date.now, lifetime = new AbortController(), client = createBffClient({baseUrl: config.origin,fetch: config.fetchImpl,signal: lifetime.signal,timeoutMs: config.timeoutMs ?? 10000}), listeners = new Set<() => void>();
 let context: RouteContext | undefined, buffer: DraftBuffer | undefined, base: StrategyDraft | undefined, head: StrategyDraft | undefined;
 let status: "empty" | "saved" | "dirty" | "saving" | "conflict" | "uncertain" | "error" = "empty", busy = false, retryAt = 0;
 let pending: {submitted: ReturnType<DraftBuffer["captureSave"]>; key: string} | undefined;
 let query: {pageSize: number; sort: string} | undefined, cursor: string | undefined;
 const cursors = new Set<string>();
 const emit = () => listeners.forEach(f => f());
 const fail = (s: number): never => {throw new StrategyError(s);};
 function guard(write = false) {
  config.authorize();
  if (lifetime.signal.aborted || !config.online() || !context) fail(403);
  if (!Number.isFinite(now()) || now() >= Date.parse(context!.expiresAt)) fail(401);
  // C05 has no strategy.read capability: writers and independent approvers read.
  if (!context!.capabilities.some(c => ["strategy.write","strategy.approve"].includes(c)) || write && (!context!.capabilities.includes("strategy.write") || !config.csrf())) fail(403);
 }
 async function checkContext() {
  if (!config.origin || lifetime.signal.aborted || !config.online()) fail(503);
  const read = async (path: "/v1/session" | "/v1/context") => {const r = await client.GET(path,{cache:"no-store"});config.authorize();if (!r.data) fail(r.response.status);return bffZodSchemas.SessionContext.parse(r.data);};
  const a = await read("/v1/session"), b = await read("/v1/context");
  if (authority(a) !== authority(b) || context && authority(context) !== authority(b) || b.mfaState === "challenged" || !["paper","shadow"].includes(b.mode)) fail(403);
  context = {...b,expiresAt: new Date(Math.min(Date.parse(a.expiresAt),Date.parse(b.expiresAt),context ? Date.parse(context.expiresAt) : Infinity)).toISOString()};guard();return structuredClone(context);
 }
 function checked<T>(r: {data?: T; error?: unknown; response: Response}): T {
  guard();if (r.response.status === 200 && r.data) return r.data;
  const e = bffZodSchemas.ErrorEnvelope.safeParse(r.error);
  throw new StrategyError(r.response.status,e.success ? e.data.correlationId : undefined);
 }
 async function readHead(id: string) {
  const r = await client.GET("/v1/strategies/{strategyId}/draft",{params:{path:{strategyId:id}},cache:"no-store"});
  const draft = bffZodSchemas.StrategyDraft.parse(checked(r));if (draft.strategyId !== id || !/^(0|[1-9]\d*)$/.test(draft.objectVersion) || BigInt(draft.objectVersion) > 18446744073709551615n) fail(502);return draft;
 }
 async function exclusive<T>(action: () => Promise<T>): Promise<T> {
  guard();if (busy) fail(409);busy = true;emit();try {return await action();} finally {busy = false;emit();}
 }
 return {
  assertCurrent: guard,
  subscribe(fn: () => void) {listeners.add(fn);return () => {listeners.delete(fn);};},
  get snapshot() {return {status,busy,retryAt,version:buffer?.expectedVersion,local:buffer?.pending,base:base && structuredClone(base),head:head && structuredClone(head),diff:base && head && buffer ? draftDiff(base,buffer.pending,head) : []};},
  load: checkContext,
  list(input: {pageSize?: number; sort?: string} = {}, more = false) {return exclusive(async () => {
   if (more && (!cursor || !query || cursors.size >= 49)) fail(422);
   const q = more ? {...query!,cursor} : {pageSize:input.pageSize ?? 25,sort:input.sort ?? "updatedAt:desc"};
   if (!Number.isInteger(q.pageSize) || q.pageSize < 1 || q.pageSize > 200 || !["updatedAt:desc","updatedAt:asc","name:asc","name:desc"].includes(q.sort)) fail(422);
   const r = await client.GET("/v1/strategies",{params:{query:q},cache:"no-store"}), page = checked(r);
   if (!Array.isArray(page.items) || page.items.length > q.pageSize) fail(502);
   const items = page.items!.map(s => bffZodSchemas.StrategySummary.parse(s)) as StrategySummary[];
   if (new Set(items.map(s => s.strategyId)).size !== items.length || page.nextCursor && (typeof page.nextCursor !== "string" || page.nextCursor === ("cursor" in q ? q.cursor : undefined) || more && cursors.has(page.nextCursor))) fail(502);
   if (more) cursors.add(cursor!);else cursors.clear();query = {pageSize:q.pageSize,sort:q.sort};cursor = page.nextCursor;return {items,nextCursor:cursor};
  });},
  open(id: string) {return exclusive(async () => {bffZodSchemas.UUID.parse(id);if (buffer) fail(409);base = await readHead(id);guard();buffer = new DraftBuffer(base);status = "saved";});},
  edit(files: string, parameters: string) {
   guard(true);if (!buffer || status === "uncertain") fail(409);
   const content = parseDraftContent(files,parameters);buffer!.edit(content.files,content.parameters);
   if (status !== "conflict" && status !== "saving") status = "dirty";emit();
  },
  async refreshConflict() {return exclusive(async () => {if (status !== "conflict" || !base) fail(409);const value = await readHead(base!.strategyId);if (BigInt(value.objectVersion) < BigInt(buffer!.expectedVersion)) fail(502);head = value;});},
  merge(content: DraftContent) {
   guard(true);if (busy || status !== "conflict" || !head || !buffer) fail(409);
   const valid = parseDraftContent(JSON.stringify(content.files),JSON.stringify(content.parameters));buffer!.resolve(head!,valid.files,valid.parameters);base = head;head = undefined;status = "error";emit();
   // Explicit save required after merge. A 409 never schedules an automatic write.
  },
  save() {return exclusive(async () => {
   guard(true);if (!buffer || !base || status === "conflict" || now() < retryAt) fail(409);
   if (status === "saved") return;
   const wasUncertain = status === "uncertain";status = "saving";emit();
   try {
    await checkContext();guard(true);
    pending ??= {submitted:buffer!.captureSave(),key:crypto.randomUUID()};const p = pending;
    const r = await client.PUT("/v1/strategies/{strategyId}/draft",{params:{path:{strategyId:p.submitted.strategyId},header:{"If-Match":p.submitted.expectedVersion,"Idempotency-Key":p.key,"X-CSRF-Token":config.csrf(),"X-Request-Id":crypto.randomUUID()}},body:{files:p.submitted.files,parameters:p.submitted.parameters}});guard(true);
    if (r.response.status === 200 && r.data) {
     const saved = bffZodSchemas.StrategyDraft.parse(r.data);buffer!.saved(saved,p.submitted);base = saved;pending = undefined;head = undefined;
     status = JSON.stringify(buffer!.pending) === JSON.stringify({files:saved.files,parameters:saved.parameters}) ? "saved" : "dirty";return;
    }
    const error = bffZodSchemas.ErrorEnvelope.safeParse(r.error);
    if (r.response.status === 409 && error.success && error.data.code === "VERSION_CONFLICT" && error.data.currentVersion) {
     buffer!.conflict(error.data);pending = undefined;status = "conflict";emit();head = await readHead(base!.strategyId);
     if (BigInt(head.objectVersion) < BigInt(error.data.currentVersion)) {head = undefined;fail(502);}
    } else if (error.success && [401,403,404,422,429].includes(r.response.status) && !wasUncertain) {
     pending = undefined;status = "error";if (r.response.status === 429) retryAt = now() + Math.min(Math.max(error.data.retryAfter ?? 60,1),3600)*1000;
    } else status = "uncertain";
    throw new StrategyError(r.response.status,error.success ? error.data.correlationId : undefined);
   } catch (error) {
    if (status === "saving") status = pending ? "uncertain" : "error";
    throw error;
   }
  });},
  close() {lifetime.abort();context = undefined;buffer = undefined;base = undefined;head = undefined;pending = undefined;cursor = undefined;query = undefined;status = "empty";cursors.clear();listeners.clear();},
 };
}
export type StrategyRuntime = ReturnType<typeof createStrategyRuntime>;
