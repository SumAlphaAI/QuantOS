import {bffZodSchemas, createBffClient, type BffComponents} from '@sumalpha/api-client';
import {completeRecentAuth, completeSecurityMfa} from '../auth/bff';
import type {RouteContext} from '../auth/route-access';
type S = BffComponents['schemas'];
type Action = 'engage' | 'release-approvals' | 'release';
type Scope = 'account' | 'global';
type Intent = {action: Action; key: string; csrf: string; deadline: number; body: S['AssistedKillIntent']};
export class KillError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}
const identity = (c: RouteContext) => JSON.stringify([c.actorId,c.tenantId,c.workspaceId,c.accountId,c.mode,c.environment,c.mfaState,[...new Set(c.capabilities)].sort()]);
export const killPhrase = (action: Action, scope: Scope) => `${action === 'engage' ? 'ENGAGE' : action === 'release' ? 'RELEASE' : 'APPROVE'} ${scope.toUpperCase()} ${action === 'release-approvals' ? 'RELEASE' : 'KILL'}`;
export function createKillRuntime(config: {origin: string; authorize: () => void; online: () => boolean; csrf: () => string; invalidate: (status: number) => void; writeAllowed: () => boolean; fetchImpl?: typeof fetch; now?: () => number}) {
  const now = config.now ?? Date.now, life = new AbortController(), listeners = new Set<() => void>();
  let context: RouteContext | undefined, state: S['AssistedKillView'] | undefined, pending: Intent | undefined, busy = false, closed = false;
  const emit = () => listeners.forEach(f => f());
  const fail = (s: number, c: string): never => { throw new KillError(s,c); };
  function close() { closed = true; life.abort(); context = undefined; state = undefined; pending = undefined; emit(); }
  function revoke(s = 403): never { close(); config.invalidate(s); return fail(s,'AUTHORITY_LOST'); }
  function guard() {
    try { config.authorize(); } catch { revoke(); }
    if (closed) fail(403,'CLOSED');
    if (!config.online()) fail(503,'OFFLINE');
    if (!Number.isFinite(now()) || context && now() >= Date.parse(context.expiresAt)) revoke(401);
  }
  const wire: typeof fetch = async (i,n) => {
    const r = await (config.fetchImpl ?? fetch)(i,n);
    if ([401,403].includes(r.status)) revoke(r.status);
    return r;
  };
  const client = createBffClient({baseUrl: config.origin, fetch: wire, signal: life.signal, timeoutMs: 5000});
  function data<T>(r: {response: Response; data?: T}): T {
    guard(); if (r.response.status !== 200 || r.data === undefined) fail(r.response.status,'UNAVAILABLE'); return r.data!;
  }
  function csrf(t: string) { if (!t || t !== config.csrf()) revoke(); }
  function fresh() { return !!state && Date.parse(state.checkedAt) <= now() && now() < Date.parse(state.expiresAt); }
  async function load() {
    guard();
    try {
      const a = bffZodSchemas.SessionContext.parse(data(await client.GET('/v1/session',{cache:'no-store'})));
      const b = bffZodSchemas.SessionContext.parse(data(await client.GET('/v1/context',{cache:'no-store'})));
      if (identity(a) !== identity(b) || context && identity(context) !== identity(b) || b.mode !== 'assisted_live' || b.mfaState === 'challenged') revoke();
      context = {...b, expiresAt: new Date(Math.min(Date.parse(a.expiresAt),Date.parse(b.expiresAt),context ? Date.parse(context.expiresAt) : Infinity)).toISOString()};
      guard();
    } catch (e) { if (e instanceof KillError && e.code === 'OFFLINE') throw e; revoke(); }
    state = undefined;
    const v = bffZodSchemas.AssistedKillView.parse(data(await client.GET('/v1/risk/kill-switch',{cache:'no-store'})));
    for (const k of ['tenantId','workspaceId','accountId'] as const) if (v[k] !== context![k]) revoke();
    if (v.generation !== v.nativeGeneration || v.nativeStopped !== (v.globalActive || v.accountActive || v.permanentNativeStop) || v.unknownCommands > v.protectedCommands || Date.parse(v.expiresAt) - Date.parse(v.checkedAt) > 8000 || Date.parse(v.expiresAt) <= Date.parse(v.checkedAt)) fail(502,'INVALID_CONTROL');
    const ids = new Set(v.history.map(e => e.eventId));
    if (ids.size !== v.history.length || v.history.some(e => BigInt(e.generation) > BigInt(v.generation)) || v.releaseApprovals.some(e => e.action !== 'approve_release' || e.generation !== v.generation || now() >= Date.parse(e.expiresAt))) fail(502,'INVALID_CONTROL');
    state = v; if (!fresh()) { state = undefined; fail(409,'STALE_CONTROL'); } emit();
  }
  function allowed(action: Action, scope: Scope) {
    guard(); if (!config.writeAllowed()) fail(409,'DESKTOP_REQUIRED');
    if (!fresh()) fail(409,'STALE_CONTROL');
    const permitted = action === 'engage' ? (scope === 'global' ? state!.canEngageGlobal : state!.canEngageAccount) : action === 'release' ? state!.canRelease : state!.canApproveRelease;
    if (!permitted) fail(403,'CONTROL_DENIED');
  }
  async function exclusive(fn: () => Promise<void>) { guard(); if (busy) fail(409,'BUSY'); busy = true; emit(); try { await fn(); } finally { busy = false; emit(); } }
  async function send(i: Intent, recovery: boolean) {
    allowed(i.action,i.body.scope); csrf(i.csrf);
    if (now() >= i.deadline) fail(409,'RECOVERY_EXPIRED');
    const header = {'Idempotency-Key':i.key,'X-CSRF-Token':i.csrf,'X-Request-Id':crypto.randomUUID()};
    const r = i.action === 'engage' ? await client.POST('/v1/risk/kill-switch/engage',{params:{header},body:i.body}) : i.action === 'release' ? await client.POST('/v1/risk/kill-switch/release',{params:{header},body:i.body}) : await client.POST('/v1/risk/kill-switch/release-approvals',{params:{header},body:i.body});
    if (!recovery && [409,422,429].includes(r.response.status)) pending = undefined;
    const receipt = bffZodSchemas.AssistedKillReceipt.parse(data(r)); csrf(i.csrf);
    const e = receipt.event, expected = BigInt(i.body.expectedGeneration) + (i.action === 'release-approvals' ? 0n : 1n);
    if (e.action !== (i.action === 'release-approvals' ? 'approve_release' : i.action) || e.scope !== i.body.scope || e.generation !== String(expected) || e.actorId !== context!.actorId || e.reason !== i.body.reason || e.approvalRef !== (i.body.approvalRef ?? null)) fail(502,'INVALID_RECEIPT');
    pending = undefined; await load(); // immutable receipt is never treated as current state
  }
  return {
    load, subscribe(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; },
    get view() { return structuredClone({state,busy,pending:!!pending,canReadAudit:context?.capabilities.includes('audit:read')===true,canRecover:!!pending && now() < pending.deadline && pending.csrf === config.csrf() && config.writeAllowed() && config.online(),fresh:fresh()}); },
    act(action: Action, scope: Scope, reason: string, code: string, approvalRef?: string) {
      return exclusive(async () => {
        if (pending) fail(409,'RECOVERY_REQUIRED');
        guard(); if (!config.writeAllowed()) fail(409,'DESKTOP_REQUIRED');
        if (!state) fail(409,'STALE_CONTROL');
        const original = state!, token = config.csrf(), started = now(); csrf(token);
        if (!reason.trim() || reason.length > 256 || [...reason].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) fail(422,'REASON_REQUIRED');
        await load(); allowed(action,scope); csrf(token);
        if (state!.generation !== original.generation) fail(409,'CONTROL_CHANGED');
        if (action === 'release' && !state!.releaseApprovals.some(p => p.eventId === approvalRef && p.scope === scope && p.actorId !== context!.actorId)) fail(409,'INDEPENDENT_REVIEW_REQUIRED');
        const challenge = await completeSecurityMfa(config.origin,code,token,wire,{signal:life.signal}); guard(); csrf(token);
        if (challenge.status !== 'verified') fail(403,'MFA_NOT_VERIFIED');
        const proof = await completeRecentAuth(config.origin,challenge.challengeRef,token,wire,{signal:life.signal}); guard(); csrf(token);
        await load(); allowed(action,scope); csrf(token);
        if (state!.generation !== original.generation) fail(409,'CONTROL_CHANGED');
        const permitDeadline = action === 'release' ? Date.parse(state!.releaseApprovals.find(p => p.eventId === approvalRef)?.expiresAt ?? '') : Infinity;
        const deadline = Math.min(started + 120000,Date.parse(context!.expiresAt),Date.parse(proof.expiresAt),permitDeadline);
        if (!Number.isFinite(deadline) || deadline <= now()) fail(409,'PROOF_EXPIRED');
        pending = {action,key:crypto.randomUUID(),csrf:token,deadline,body:{scope,accountId:scope === 'global' ? null : context!.accountId!,expectedGeneration:original.generation,reason,confirmPhrase:killPhrase(action,scope),mfaChallengeRef:challenge.challengeRef,reauthTokenRef:proof.reauthTokenRef,...(approvalRef ? {approvalRef} : {})}};
        await send(pending,false);
      });
    },
    recover() { return exclusive(async () => { if (!pending) fail(409,'NO_PENDING'); const i = pending!; csrf(i.csrf); if (now() >= i.deadline) fail(409,'RECOVERY_EXPIRED'); await load(); await send(i,true); }); },
    close
  };
}
export type KillRuntime = ReturnType<typeof createKillRuntime>;
