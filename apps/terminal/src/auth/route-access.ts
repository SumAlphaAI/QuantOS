import {bffZodSchemas, createBffClient, createBffFetch} from "@sumalpha/api-client";
import type {BffComponents} from "@sumalpha/api-client";
import {subscribeAuthInvalidation} from "./invalidation";
export type RouteContext = BffComponents["schemas"]["SessionContext"];
export type AccessLoss = {reason: "revoked" | "scope" | "expired" | "offline" | "hidden" | "focus" | "unavailable" | "stream"; status?: number};
// Streaming revocations are primary; C01 revalidation bounds silent failures.
export const routeAccessPolicy = {pollMs: 5000, requestMs: 3000, maxUnverifiedMs: 8000, maxFrameChars: 16384} as const;
export interface AccessEnvironment {
  online(): boolean; visible(): boolean;
  subscribe(listener: (reason: "offline" | "hidden" | "focus") => void): () => void;
}
export function browserAccessEnvironment(): AccessEnvironment {
  return {online: () => navigator.onLine, visible: () => !document.hidden, subscribe(listener) {
    const offline = () => listener("offline"), visibility = () => {if (document.hidden) listener("hidden");}, focus = () => listener("focus");
    window.addEventListener("offline", offline);document.addEventListener("visibilitychange", visibility);window.addEventListener("focus", focus);
    return () => {window.removeEventListener("offline", offline);document.removeEventListener("visibilitychange", visibility);window.removeEventListener("focus", focus);};
  }};
}
function authority(c: RouteContext) {return JSON.stringify([c.actorId, c.tenantId, c.workspaceId, c.accountId, c.mode, c.environment, c.mfaState, [...new Set(c.capabilities)].sort()]);}
export function createRouteAccess(options: {mock: boolean; origin?: string; fetchImpl?: typeof fetch; environment: AccessEnvironment; onInvalidate: (loss: AccessLoss) => void; now?: () => number}) {
  const now = options.now ?? Date.now, lifetime = new AbortController();
  const transport = options.fetchImpl ?? fetch;
  let baseline: RouteContext | undefined, deadline = Infinity, verifiedUntil = Infinity, closed = false, opened = false;
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined, pollTimer: ReturnType<typeof setTimeout> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const unsubscribeEnvironment = options.environment.subscribe(reason => invalidate({reason}));
  const unsubscribeAuth = subscribeAuthInvalidation(kind => invalidate(kind === "session" ? {reason: "revoked", status: 401} : {reason: "scope"}));
  function dispose() {lifetime.abort();void reader?.cancel().catch(() => {});clearTimeout(deadlineTimer);clearTimeout(pollTimer);unsubscribeEnvironment();unsubscribeAuth();}
  function invalidate(loss: AccessLoss) {if (closed) return;closed = true;dispose();baseline = undefined;options.onInvalidate(loss);}
  function assertCurrent() {
    if (closed) throw Error("Route access invalidated");
    if (!options.environment.online()) invalidate({reason: "offline"});
    else if (!options.environment.visible()) invalidate({reason: "hidden"});
    else if (!Number.isFinite(now()) || now() >= Math.min(deadline, verifiedUntil)) invalidate({reason: "expired"});
    if (closed) throw Error("Route access invalidated");
  }
  function armDeadline() {clearTimeout(deadlineTimer);const until = Math.min(deadline, verifiedUntil);deadlineTimer = setTimeout(() => {try {assertCurrent();armDeadline();} catch { /* already cleared */ }}, Math.max(0, Math.min(until - now(), 2_147_483_647)));}
  async function probe() {
    assertCurrent();const started = now();
    const client = createBffClient({baseUrl: options.origin!, fetch: transport, signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(routeAccessPolicy.requestMs)]), timeoutMs: routeAccessPolicy.requestMs});
    const checked = <T>(r: {data?: T; response: Response}) => {if (r.response.status !== 200 || !r.data) throw Object.assign(Error("Route authorization unavailable"), {status: r.response.status});return bffZodSchemas.SessionContext.parse(r.data);};
    const session = checked(await client.GET("/v1/session", {cache: "no-store"}));assertCurrent();
    const context = checked(await client.GET("/v1/context", {cache: "no-store"}));assertCurrent();
    if (!baseline || authority(session) !== authority(context) || authority(context) !== authority(baseline)) {invalidate({reason: "scope", status: 403});throw Error("Route authority changed");}
    const expiry = Math.min(Date.parse(session.expiresAt), Date.parse(context.expiresAt));
    if (session.mfaState === "challenged" || !Number.isFinite(expiry) || expiry <= now()) {invalidate({reason: "expired", status: 401});throw Error("Route identity expired");}
    deadline = Math.min(deadline, expiry);verifiedUntil = started + routeAccessPolicy.maxUnverifiedMs;assertCurrent();armDeadline();
  }
  function failure(error: unknown) {const status = (error as {status?: number})?.status;invalidate({reason: status === 401 || status === 403 || status === 404 ? "revoked" : "unavailable", status});}
  function scheduleProbe() {if (closed) return;pollTimer = setTimeout(() => {void probe().then(scheduleProbe).catch(failure);}, routeAccessPolicy.pollMs);}
  async function readStream(body: ReadableStream<Uint8Array>) {
    reader = body.getReader();const decoder = new TextDecoder("utf-8", {fatal: true});let buffer = "", streamId: string | undefined, sequence = 0;
    try {
      while (!closed) {
        const part = await reader.read();if (part.done) throw Error("Authorization stream ended");
        buffer += decoder.decode(part.value, {stream: true});let index: number;
        while ((index = buffer.search(/\r?\n\r?\n/)) >= 0) {
          const raw = buffer.slice(0, index);buffer = buffer.slice(index + (buffer[index] === "\r" ? 4 : 2));
          if (raw.length > routeAccessPolicy.maxFrameChars) throw Error("Oversized authorization frame");
          const data = raw.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");if (!data) continue;
          const event = bffZodSchemas.StreamEvent.parse(JSON.parse(data));
          // A terminal hint always narrows authority, even if its sequence is old.
          if (event.payload.type === "permission_revoked") {invalidate({reason: "revoked", status: 403});return;}
          if (streamId && streamId !== event.streamId) throw Error("Authorization stream identity changed");streamId = event.streamId;
          // This is an invalidation channel, not a domain projection. Live per-user
          // events have global sequence values, so numeric gaps need not be loss.
          if (event.sequence <= sequence) continue;sequence = event.sequence;
          if (event.payload.type !== "session_revoked") throw Error("Unexpected authorization event");
        }
        if (buffer.length > routeAccessPolicy.maxFrameChars) throw Error("Oversized authorization frame");
      }
    } catch {if (!closed) invalidate({reason: "stream"});}
    finally {await reader.cancel().catch(() => {});reader.releaseLock();}
  }
  return {
    assertCurrent,
    invalidate,
    get closed() {return closed;},
    async bind(context: RouteContext, resourceDeadline = Date.parse(context.expiresAt)) {
      assertCurrent();context = bffZodSchemas.SessionContext.parse(context);
      if (baseline && authority(baseline) !== authority(context)) {invalidate({reason: "scope", status: 403});throw Error("Route authority changed");}
      if (context.mfaState === "challenged" || !Number.isFinite(resourceDeadline) || Date.parse(context.expiresAt) <= now() || resourceDeadline <= now()) {invalidate({reason: "expired", status: 401});throw Error("Route expired");}
      baseline = context;deadline = Math.min(resourceDeadline, Date.parse(context.expiresAt));
      if (options.mock) {armDeadline();return;}
      verifiedUntil = now() + routeAccessPolicy.maxUnverifiedMs;armDeadline();
      if (!opened) {
        if (!options.origin) throw Error("BFF not configured");
        try {
          const response = await createBffFetch(transport, {signal: lifetime.signal, timeoutMs: routeAccessPolicy.requestMs})(new URL("/v1/settings/sessions/stream?afterSequence=0", options.origin), {credentials: "include", cache: "no-store", headers: {accept: "text/event-stream"}});
          if (response.status !== 200 || !response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {await response.body?.cancel();throw Object.assign(Error("Authorization stream unavailable"), {status: response.status});}
          opened = true;void readStream(response.body);await probe();assertCurrent();scheduleProbe();
        } catch (error) {failure(error);throw error;}
      } else {await probe();assertCurrent();}
    },
    close() {if (!closed) {closed = true;dispose();baseline = undefined;}},
  };
}
