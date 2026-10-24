import { bffZodSchemas, createBffClient, createBffFetch } from '@sumalpha/api-client';
import type { RouteContext } from '../auth/route-access';
import { completeSecurityMfa, completeRecentAuth } from '../auth/bff';
import { apiPath, collections, collectionOf, core, resource, draft, committed, same, version, type Collection, type Resource, type Review, type Spec } from './policy';
export class AdminError extends Error {
    constructor(readonly status: number, readonly code = 'UNAVAILABLE', readonly correlationId?: string) { super('Governance could not be verified'); }
}
type Intent = {
    collection: Collection;
    method: 'POST' | 'PUT' | 'DELETE';
    path: string;
    version: string;
    revision: string;
    spec: Spec;
    before?: Resource;
    body: string;
    headers: Record<string, string>;
    csrf: string;
};
const authority = (c: RouteContext) => JSON.stringify([c.actorId, c.tenantId, c.workspaceId, c.accountId, c.mode, c.environment, c.mfaState, [...new Set(c.capabilities)].sort()]);
export function createAdminRuntime(config: {
    origin: string;
    authorize: () => void;
    online: () => boolean;
    csrf: () => string;
    desktop: () => boolean;
    invalidate: (status: number) => void;
    fetchImpl?: typeof fetch;
    now?: () => number;
}) {
    const now = config.now ?? Date.now, life = new AbortController(), transport = config.fetchImpl ?? fetch, client = createBffClient({ baseUrl: config.origin, fetch: transport, signal: life.signal, timeoutMs: 10000 }), request = createBffFetch(transport, { signal: life.signal, timeoutMs: 10000 }), listeners = new Set<() => void>();
    let context: RouteContext | undefined, rows: Resource[] = [], reviews: Review[] = [], revision: string | undefined, receipts: Resource[] = [], pending: Intent | undefined, status = 'empty', busy = false, retryAt = 0;
    const emit = () => listeners.forEach(f => f()), fail = (s: number, c: string): never => { throw new AdminError(s, c); };
    function clear() { rows = []; reviews = []; revision = undefined; receipts = []; pending = undefined; }
    function invalidate(s: number) { clear(); context = undefined; status = 'blocked'; config.invalidate(s); emit(); }
    function guard() { try {
        config.authorize();
        if (life.signal.aborted || !config.online() || !context || !context.capabilities.includes('admin.read') || !['paper', 'shadow'].includes(context.mode))
            fail(403, 'FORBIDDEN');
        if (!Number.isFinite(now()) || now() >= Date.parse(context!.expiresAt))
            fail(401, 'EXPIRED');
    }
    catch (e) {
        invalidate((e as {
            status?: number;
        }).status ?? 403);
        throw e;
    } }
    function writable() { guard(); if (!config.desktop() || !context!.capabilities.includes('admin.write'))
        fail(403, 'DESKTOP_PERMISSION_REQUIRED'); }
    function refusal(status: number, raw: unknown): never { const e = bffZodSchemas.ErrorEnvelope.safeParse(raw); if (status === 429)
        retryAt = now() + Math.min(Math.max(e.success ? e.data.retryAfter ?? 60 : 60, 1), 3600) * 1000; if ([401, 403].includes(status))
        invalidate(status); throw new AdminError(status, e.success ? e.data.code : 'UNAVAILABLE', e.success ? e.data.correlationId : undefined); }
    async function read(path: string) { guard(); const r = await request(config.origin + path, { credentials: 'include', cache: 'no-store' }); const raw: unknown = await r.json(); guard(); if (r.status !== 200)
        refusal(r.status, raw); return raw; }
    async function identity() { config.authorize(); if (!config.online() || life.signal.aborted)
        fail(503, 'OFFLINE'); const load = async (path: '/v1/session' | '/v1/context') => { const r = await client.GET(path, { cache: 'no-store' }); if (r.response.status !== 200)
        refusal(r.response.status, r.error); return bffZodSchemas.SessionContext.parse(r.data); }; const a = await load('/v1/session'), b = await load('/v1/context'); if (life.signal.aborted)
        fail(403, 'CLOSED'); if (authority(a) !== authority(b) || context && authority(context) !== authority(b) || b.mfaState === 'challenged') {
        invalidate(403);
        fail(403, 'SCOPE_CHANGED');
    } context = { ...b, expiresAt: new Date(Math.min(Date.parse(a.expiresAt), Date.parse(b.expiresAt), context ? Date.parse(context.expiresAt) : Infinity)).toISOString() }; guard(); return structuredClone(context); }
    async function catalog() {
        const all: Resource[] = [], approved: Review[] = [];
        let rev: string | undefined;
        for (const c of collections) {
            let cursor: string | undefined;
            const seen = new Set<string>(), ids = new Set<string>();
            let last = '';
            do {
                const q = new URLSearchParams({ pageSize: '100', sort: 'id:asc', ...cursor ? { cursor } : {} }), p = bffZodSchemas.AdminResourcePage.parse(await read(apiPath(c) + '?' + q));
                version(p.configVersion);
                if (rev && rev !== p.configVersion)
                    fail(409, 'CATALOG_CHANGED');
                rev = p.configVersion;
                for (const raw of p.items) {
                    const r = resource(raw, c);
                    if (ids.has(r.id) || last && r.id <= last || ids.size >= 1000 || version(r.configVersion) > version(rev))
                        fail(502, 'PAGE_MISMATCH');
                    ids.add(r.id);
                    last = r.id;
                    all.push(r);
                }
                if (c === 'capabilities' && !cursor)
                    approved.push(...p.availableReviews ?? []);
                cursor = p.nextCursor ?? undefined;
                if (cursor) {
                    if (seen.has(cursor) || seen.size >= 9)
                        fail(502, 'PAGE_LIMIT');
                    seen.add(cursor);
                }
            } while (cursor);
        }
        // Each collection has its own cursor; reject a mixed configuration across collections.
        const head = bffZodSchemas.AdminResourcePage.parse(await read(apiPath('members') + '?pageSize=1&sort=id%3Aasc'));
        if (head.configVersion !== rev)
            fail(409, 'CATALOG_CHANGED');
        return { all, approved, rev: rev! };
    }
    function noPending() { if (pending)
        fail(409, 'RECOVERY_REQUIRED'); }
    async function exclusive(fn: () => Promise<void>) { guard(); if (busy)
        fail(409, 'BUSY'); if (now() < retryAt)
        fail(429, 'RATE_LIMITED'); busy = true; emit(); try {
        await identity();
        await fn();
        guard();
    }
    catch (e) {
        const x = e as {
            status?: number;
            retryAfter?: number;
        };
        if (x.status === 429 && retryAt <= now())
            retryAt = now() + Math.min(Math.max(x.retryAfter ?? 60, 1), 3600) * 1000;
        if ([401, 403].includes(x.status ?? 0))
            invalidate(x.status!);
        if (context && !life.signal.aborted)
            status = pending ? 'uncertain' : 'error';
        throw e;
    }
    finally {
        busy = false;
        emit();
    } }
    async function send(recovering: boolean) { const p = pending!; writable(); if (config.csrf() !== p.csrf) {
        invalidate(403);
        fail(403, 'CSRF_CHANGED');
    } const r = await request(config.origin + p.path, { method: p.method, headers: p.headers, body: p.body, credentials: 'include', cache: 'no-store' }), raw: unknown = await r.json(); guard(); if (r.status !== (p.method === 'POST' ? 201 : 200)) {
        const valid = bffZodSchemas.ErrorEnvelope.safeParse(raw);
        if (!recovering && valid.success && [401, 403, 409, 410, 422, 429].includes(r.status)) {
            pending = undefined;
            rows = [];
            reviews = [];
            revision = undefined;
        }
        refusal(r.status, raw);
    } const receipt = committed(raw, p.collection, p.method, p.spec, p.before, p.revision); receipts = [receipt, ...receipts].slice(0, 25); pending = undefined; rows = []; reviews = []; revision = undefined; status = 'saved'; }
    return { load: identity, subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }, get view() { return structuredClone({ rows, reviews, revision, receipts, status, busy, retryAt, pending: !!pending }); },
        refresh() { return exclusive(async () => { noPending(); rows = []; reviews = []; revision = undefined; status = 'loading'; emit(); const c = await catalog(); rows = c.all; reviews = c.approved; revision = c.rev; status = 'ready'; }); },
        act(collection: Collection, method: 'POST' | 'PUT' | 'DELETE', raw: unknown, id: string | undefined, reason: string, code: string, confirmed: boolean) {
            return exclusive(async () => {
                noPending();
                writable();
                if (!collections.includes(collection) || !['POST', 'PUT', 'DELETE'].includes(method))
                    fail(422, 'INVALID_ACTION');
                if (!revision || !confirmed || !reason.trim() || reason.length > 256 || [...reason].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) || !/^\d{6}$/.test(code) || !config.csrf())
                    fail(422, 'REVIEW_REQUIRED');
                if (method !== 'POST')
                    bffZodSchemas.UUID.parse(id);
                const before = method === 'POST' ? undefined : rows.find(r => r.id === id);
                if (method !== 'POST' && (!before || before.deleted || before.protected))
                    fail(409, 'RESOURCE_UNAVAILABLE');
                const s = method === 'DELETE' ? before!.spec : draft(raw, collection, rows, reviews);
                if (before && (collectionOf(before.spec) !== collection || before.spec.kind !== s.kind))
                    fail(422, 'KIND_CHANGED');
                const rev = revision!, csrf = config.csrf(), snapshot = structuredClone(before);
                const mfa = await completeSecurityMfa(config.origin, code, csrf, transport, { signal: life.signal });
                guard();
                if (mfa.status !== 'verified')
                    fail(403, 'MFA_REQUIRED');
                const proof = await completeRecentAuth(config.origin, mfa.challengeRef, csrf, transport, { signal: life.signal });
                writable();
                if (config.csrf() !== csrf || !Number.isFinite(Date.parse(proof.expiresAt)) || now() >= Date.parse(proof.expiresAt))
                    fail(403, 'PROOF_EXPIRED');
                const fresh = await catalog();
                if (fresh.rev !== rev || snapshot && !same(core(snapshot), fresh.all.find(r => r.id === snapshot.id) && core(fresh.all.find(r => r.id === snapshot.id)!))) {
                    rows = [];
                    reviews = [];
                    revision = undefined;
                    fail(409, 'VERSION_CONFLICT');
                }
                if (method !== 'DELETE')
                    draft(s, collection, fresh.all, fresh.approved);
                writable();
                const v = before?.objectVersion ?? rev;
                pending = { collection, method, path: apiPath(collection) + (before ? '/' + before.id : ''), version: v, revision: rev, spec: s, before: snapshot, csrf, headers: { 'content-type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), 'X-Request-Id': crypto.randomUUID(), 'If-Match': v, 'X-CSRF-Token': csrf }, body: JSON.stringify({ reason: reason.trim(), mfaChallengeRef: mfa.challengeRef, reauthTokenRef: proof.reauthTokenRef, ...method === 'DELETE' ? {} : { spec: s } }) };
                await send(false);
            });
        },
        retry() { return exclusive(async () => { if (!pending)
            fail(409, 'NO_PENDING'); await send(true); }); }, close() { life.abort(); clear(); context = undefined; listeners.clear(); }
    };
}
export type AdminRuntime = ReturnType<typeof createAdminRuntime>;
