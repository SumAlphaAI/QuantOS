// Fresh GET-only consumer, explicitly reusing the unchanged original G6 reference binary.
import { referenceBffExecutable, referenceBffRoot } from './helpers/reference-bff';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { createAlertsRuntime } from '../src/alerts/runtime';
import { createOperationsRuntime } from '../src/operations/runtime';
import { createAdminRuntime } from '../src/admin/runtime';
import { operationsClient } from '../src/operations/gateway';
import { searchAuditEvents } from '../src/audit/gateway';
import { summary, currentReview } from '../src/admin/p14-presentation';
import { serviceViews, observationState } from '../src/operations/p13-presentation';
import { alertDeepLink, responseDestinations } from '../src/alerts/p23-presentation';
const binarySource = '1cee533781312f684c4c5ac121a13a5922c689a0', fixtureSource = process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: referenceBffRoot, encoding: 'utf8' }).trim(), rows: {
    method: string;
    path: string;
    status: number;
    cache: string;
    responseHash: string;
    sessionKind: string;
}[] = [];
let child: ChildProcess, origin: string;
const transport = (session = 'session-current'): typeof fetch => async (i, n) => { const r = new Request(i, n), u = new URL(r.url); if (u.origin !== origin || r.method !== 'GET')
    throw Error('FEP6 consumer is strictly loopback GET-only'); r.headers.set('cookie', `quantos_session=${session}; quantos_csrf=csrf-token-0000000000000001`); r.headers.set('origin', 'http://localhost:3190'); let response: Response, bytes: ArrayBuffer; try {
    response = await fetch(r);
    bytes = await response.clone().arrayBuffer();
}
catch (e) {
    console.error('FEP6 read transport failed', u.pathname, String(e));
    throw e;
} rows.push({ method: r.method, path: u.pathname, status: response.status, cache: r.cache, responseHash: 'sha256:' + createHash('sha256').update(Buffer.from(bytes)).digest('hex'), sessionKind: session === 'session-owner' ? 'OWNED_REFERENCE_OWNER' : session === 'session-viewer' ? 'OWNED_REFERENCE_VIEWER' : 'OWNED_REFERENCE_OPERATOR' }); return response; };
beforeAll(async () => { expect(process.env.DATABASE_URL).toBeUndefined(); expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined(); const server = createServer(); await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); }); const port = (server.address() as {
    port: number;
}).port; await new Promise<void>(r => server.close(() => r())); origin = `http://127.0.0.1:${port}`; child = spawn(referenceBffExecutable(), [], { cwd: referenceBffRoot, env: { PATH: process.env.PATH, HOME: process.env.HOME, GITHUB_SHA: fixtureSource, NODE_ENV: 'test', QUANTOS_SKIP_ENV: '1', QUANTOS_BFF_MODE: 'reference', QUANTOS_BFF_BIND: `127.0.0.1:${port}` }, stdio: ['ignore', 'pipe', 'pipe'] }); child.stderr!.on('data', b => console.error(String(b))); await new Promise<void>((done, reject) => { const timer = setTimeout(() => { child.kill(); reject(Error('Reference startup timeout')); }, 15000); child.once('error', e => { clearTimeout(timer); reject(e); }); child.once('exit', () => { clearTimeout(timer); reject(Error('Reference exited')); }); child.stdout!.on('data', b => { if (String(b).includes('"ready":true')) {
    clearTimeout(timer);
    done();
} }); }); }, 20000);
afterAll(async () => { if (child?.exitCode === null) {
    child.kill();
    await new Promise(r => child.once('close', r));
} });
it('FEP6 actual read-only C01/C16/C11/C10 scope census preserves separate Owner/Operator admission and explicit gaps', async () => {
    const config = (session = 'session-current') => ({ origin, fetchImpl: transport(session), authorize: () => { }, online: () => true, csrf: () => '', desktop: () => true, invalidate: () => { } }), a = createAlertsRuntime(config()), o = createOperationsRuntime(config()), g = createAdminRuntime(config('session-owner')), viewer = createAdminRuntime(config('session-viewer'));
    try {
        const operator = await a.load();
        await a.refresh();
        const initial = a.view.items;
        expect(initial.length).toBeGreaterThan(0);
        const id = initial[0].id;
        await a.open(id);
        expect(alertDeepLink(origin, id)).toBe(origin + '/alerts/' + id);
        expect(responseDestinations(a.view.detail!, operator).health).toBe(true);
        await a.readSubscriptions();
        await a.connect();
        expect(a.view.stream).toBe('disconnected');
        expect(a.view.items).toEqual(initial);
        const opContext = await o.load();
        expect(opContext.accountId).toBe(operator.accountId);
        expect(opContext.mode).toBe('paper');
        await o.refresh();
        expect(o.view.health?.ready).toBe(false);
        expect(observationState(o.view.health, Date.now())).toBe('degraded');
        expect(o.view.available.map(r => r.actionId)).toEqual(['inspect-health', 'inspect-evidence']);
        await o.inspectAlert(id);
        expect(o.view.sourceAlert?.sourceRef).toBe(a.view.detail?.sourceRef);
        expect(o.view.sourceAlert?.sourceVersion).toBe(a.view.detail?.sourceVersion);
        await o.check('inspect-evidence', crypto.randomUUID());
        expect(o.view.check?.allowed).toBe(false);
        expect(serviceViews().every(s => s.state === 'not-provided')).toBe(true);
        const owner = await g.load();
        expect(owner.accountId).toBe(operator.accountId);
        expect(owner.actorId).not.toBe(operator.actorId);
        expect(owner.capabilities).not.toContain('audit:read');
        expect(operator.capabilities).not.toContain('admin.write');
        await g.refresh();
        const counts = summary(g.view.rows, !!g.view.revision);
        expect(counts?.members).toBeGreaterThan(0);
        expect(g.view.reviews.length).toBeGreaterThan(0);
        expect(g.view.rows.filter(r => r.spec.kind === 'engine_capability')).toEqual([]);
        expect(currentReview(undefined, g.view.reviews)).toBeUndefined();
        await expect(viewer.load()).rejects.toMatchObject({ status: 403 });
        const ownerAudit = await operationsClient(origin, transport('session-owner')).GET('/v1/audit/events', { params: { query: { pageSize: 100 } } });
        expect([403, 404]).toContain(ownerAudit.response.status);
        const audit = await searchAuditEvents(origin, { pageSize: 100, sort: 'occurredAt:asc' }, transport());
        expect(audit.items.length).toBeLessThanOrEqual(100);
        expect(rows.every(r => r.method === 'GET')).toBe(true);
        expect(rows.filter(r => r.path !== '/v1/audit/events').every(r => r.cache === 'no-store')).toBe(true);
        const out = process.env.QUANTOS_FEP6_READ_RECEIPT;
        if (out)
            writeFileSync(out, JSON.stringify({ schema: 'quantos-fep6-read-consumer/v1', sourceCommit: process.env.GITHUB_SHA, binarySourceCommit: binarySource, fixtureSourceCommit: fixtureSource, binarySha256: 'sha256:' + createHash('sha256').update(readFileSync(referenceBffExecutable())).digest('hex'), scope: 'READ_ONLY_ACTUAL_OWNED_REFERENCE_BINARY_REUSED', identity: 'EXPLICIT_COOKIE_TRANSPORT_INJECTION', cors: 'NOT_EXERCISED_NODE_HTTP', data: 'OWNED_SYNTHETIC_REFERENCE_SINGLE_INSTANCE', accountId: operator.accountId, mode: operator.mode, alert: { id, sourceRef: a.view.detail?.sourceRef, sourceVersion: a.view.detail?.sourceVersion, resolved: a.view.detail?.resolved, stream: a.view.stream, subscriptionVersion: a.view.subscription?.objectVersion }, operations: { accountId: o.view.health?.accountId, sourceHash: o.view.health?.sourceHash, sourceAlertId: o.view.sourceAlert?.id, sourceAlertRef: o.view.sourceAlert?.sourceRef, sourceVersion: o.view.sourceAlert?.sourceVersion, healthReady: o.view.health?.ready, incidentCount: o.view.incidents.length, inspectEvidenceAllowed: o.view.check?.allowed, independentServiceHealth: 'NOT_PROVIDED' }, admin: { configVersion: g.view.revision, counts, resourceCount: g.view.rows.length, availableReviews: g.view.reviews.length, enabledEngines: counts?.enabledEngines, ownerHasAuditRead: owner.capabilities.includes('audit:read'), operatorHasAdminWrite: operator.capabilities.includes('admin.write'), ownerAuditStatus: ownerAudit.response.status, viewerAdmitted: false }, audit: { itemCount: audit.items.length, scope: 'AUTHORIZED_CATALOG_ONLY_NOT_NEW_MUTATION_CHAIN' }, businessWrites: 0, newMutationAuditChain: 'NOT_RUN_READ_ONLY', g6Gate: 'NOT_READY_GAPS_OPEN', rows }, null, 2) + '\n');
    }
    finally {
        a.close();
        o.close();
        g.close();
        viewer.close();
    }
    expect(a.view.items).toEqual([]);
    expect(o.view.health).toBeUndefined();
    expect(g.view.rows).toEqual([]);
}, 15000);
