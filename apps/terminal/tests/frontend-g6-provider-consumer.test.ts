import { referenceBffExecutable, referenceBffRoot, referenceBffSourceEnv } from "./helpers/reference-bff";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { beforeEach, afterEach, expect, it } from "vitest";
import { createAdminRuntime } from "../src/admin/runtime";
import type { Resource } from "../src/admin/policy";
import { loadEvidenceChain } from "../src/audit/gateway";
let child: ChildProcess, origin: string, lose = '';
const replies: {
    path: string;
    status: number;
    body: unknown;
}[] = [];
const requests: Request[] = [];
const csrf = 'csrf-token-0000000000000001';
const transport = (session = 'session-owner'): typeof fetch => async (input, init) => {
    const req = new Request(input, init);
    req.headers.set('cookie', `quantos_session=${session}; quantos_csrf=${csrf}`);
    req.headers.set('origin', 'http://localhost:3190');
    requests.push(req.clone());
    const res = await fetch(req);
    if (req.method !== 'GET' && !new URL(req.url).pathname.startsWith('/v1/auth/'))
        replies.push({ path: new URL(req.url).pathname, status: res.status, body: await res.clone().json().catch(() => undefined) });
    if (lose && ['POST', 'PUT', 'DELETE'].includes(req.method) && req.url.includes(lose)) {
        lose = '';
        await res.body?.cancel();
        throw Error('lost reply after committed governance');
    }
    return res;
};
beforeEach(async () => {
    requests.length = 0;
    replies.length = 0;
    lose = '';
    const server = createServer();
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as {
        port: number;
    }).port;
    await new Promise<void>(r => server.close(() => r()));
    origin = `http://127.0.0.1:${port}`;
    child = spawn(referenceBffExecutable(), [], { cwd: referenceBffRoot, env: { ...referenceBffSourceEnv(), NODE_ENV: 'test', PATH: process.env.PATH, HOME: process.env.HOME, QUANTOS_SKIP_ENV: '1', QUANTOS_BFF_MODE: 'reference', QUANTOS_BFF_BIND: `127.0.0.1:${port}` }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise<void>((r, j) => {
        const t = setTimeout(() => j(Error('startup timeout')), 30000);
        child.once('error', e => { clearTimeout(t); j(e); });
        child.once('exit', () => { clearTimeout(t); j(Error('reference exited')); });
        child.stdout?.on('data', b => {
            if (String(b).includes('"ready":true')) {
                clearTimeout(t);
                r();
            }
        });
    });
}, 35000);
afterEach(async () => {
    if (child?.exitCode === null) {
        child.kill();
        await new Promise(r => child.once('close', r));
    }
});
import { createAlertsRuntime } from '../src/alerts/runtime';
import { createOperationsRuntime } from '../src/operations/runtime';
import { operationsClient } from '../src/operations/gateway';
const config = (session = 'session-current') => ({ origin, fetchImpl: transport(session), authorize: () => { }, online: () => true, csrf: () => csrf, desktop: () => true, invalidate: () => { } });
const alerts = () => createAlertsRuntime(config()), ops = (session = 'session-current') => createOperationsRuntime(config(session)), admin = () => createAdminRuntime(config('session-owner'));
async function audit(r: {
    auditRef?: string;
    correlationId?: string;
}) { expect(r.auditRef).toBeTruthy(); expect(r.correlationId).toBeTruthy(); const chain = await loadEvidenceChain(origin, r.correlationId!, {}, transport('session-current')); expect(chain.items.filter(x => x.eventId === r.auditRef)).toHaveLength(1); return chain; }
async function sameRequest(path: string, start: number) { const q = requests.slice(start).filter(r => r.method !== 'GET' && new URL(r.url).pathname === path); expect(q).toHaveLength(2); expect(await q[0].text()).toBe(await q[1].text()); for (const h of ['idempotency-key', 'if-match', 'x-request-id', 'x-csrf-token'])
    expect(q[0].headers.get(h)).toBe(q[1].headers.get(h)); }
async function readyAdmin() { const r = admin(); await r.load(); await r.refresh(); return r; }
it('G6 one actual BFF composes subscriptions/alert ack, Incident acknowledgement, approved runbook and Admin with unique C10 roots', async () => {
    const a = alerts(), o = ops(), g = await readyAdmin(), context = await a.load();
    await a.refresh();
    await a.readSubscriptions();
    await a.connect();
    expect(a.view.stream).toBe('disconnected');
    const id = a.view.items[0].id;
    await a.open(id);
    const source = a.view.detail!;
    let start = requests.length;
    lose = '/v1/alerts/' + id + '/ack';
    await expect(a.act('ack', 'G6 read is not resolution', '123456', true)).rejects.toThrow();
    await a.retry();
    await sameRequest('/v1/alerts/' + id + '/ack', start);
    expect(a.view.detail?.active).toBe(true);
    expect(a.view.detail?.resolved).toBe(false);
    expect(a.view.detail?.sourceVersion).toBe(source.sourceVersion);
    await audit(a.view.detail!);
    await a.readEvidence();
    expect(a.view.evidence?.items.some(x => x.eventId === a.view.detail?.auditRef)).toBe(true);
    await a.save({ domains: ['system', 'risk'], severities: ['warning', 'critical'] });
    await audit(a.view.subscription!);
    expect(a.view.stream).toBe('reset-required');
    await a.connect(true);
    expect(a.view.stream).toBe('disconnected');
    await o.load();
    await o.refresh();
    await o.inspectAlert(id);
    start = requests.length;
    lose = '/v1/operations/incidents';
    await expect(o.act('open', 'G6 incident from same alert', '123456', true)).rejects.toThrow();
    await o.retry();
    await sameRequest('/v1/operations/incidents', start);
    const incident = o.view.selected!;
    expect(incident.alertId).toBe(id);
    expect(incident.accountId).toBe(context.accountId);
    expect(incident.mode).toBe(context.mode);
    await audit(incident);
    await o.open(incident.id);
    await o.act('ack', 'G6 acknowledge without solving source', '123456', true);
    await audit(o.view.selected!);
    await o.open(incident.id);
    expect(o.view.events?.items).toHaveLength(2);
    await o.check('inspect-health');
    start = requests.length;
    lose = '/v1/operations/runbook-actions/inspect-health/runs';
    await expect(o.act('run', 'G6 approved diagnostic only', '123456', true)).rejects.toThrow();
    await o.retry();
    await sameRequest('/v1/operations/runbook-actions/inspect-health/runs', start);
    expect(o.view.run?.status).toBe('succeeded');
    await audit(o.view.run!);
    await g.refresh();
    const reviewed = g.view.reviews[0];
    await g.act('capabilities', 'POST', { ...reviewed, enabled: true }, undefined, 'G6 existing signed review', '123456', true);
    await audit(g.view.receipts[0]);
    await g.refresh();
    const role = g.view.rows.find(r => r.spec.kind === 'role' && r.spec.baseRole === 'viewer')!;
    await g.act('policies', 'POST', { kind: 'policy', name: 'g6_viewer_denial', roleId: role.id, deniedCapabilities: ['ops.operate'], active: true }, undefined, 'G6 bounded denial policy', '123456', true);
    await audit(g.view.receipts[0]);
    await a.open(id);
    expect(a.view.detail?.active).toBe(true);
    expect(a.view.detail?.resolved).toBe(false);
    expect(a.view.detail?.sourceRef).toBe(source.sourceRef);
    expect(o.view.selected?.status).toBe('acknowledged');
    expect(new Set(replies.filter(r => [200, 201].includes(r.status)).map(r => (r.body as Resource).auditRef).filter(Boolean)).size).toBe(7);
    a.close();
    o.close();
    g.close();
}, 30000);
it('G6 governance withdrawal precedes unknown replay across both existing runtimes without widening fresh reader authority', async () => {
    const a = alerts(), o = ops(), g = await readyAdmin();
    await a.load();
    await a.refresh();
    const id = a.view.items[0].id;
    await a.open(id);
    lose = '/v1/alerts/' + id + '/ack';
    await expect(a.act('ack', 'G6 pending alert before withdrawal', '123456', true)).rejects.toThrow();
    await o.load();
    await o.refresh();
    await o.check('inspect-health');
    lose = '/v1/operations/runbook-actions/inspect-health/runs';
    await expect(o.act('run', 'G6 pending diagnostic before withdrawal', '123456', true)).rejects.toThrow();
    expect(a.view.pending && o.view.pending).toBe(true);
    const role = g.view.rows.find(r => r.spec.kind === 'role' && r.spec.baseRole === 'operator')!;
    await g.act('policies', 'POST', { kind: 'policy', name: 'g6_remove_operator', roleId: role.id, deniedCapabilities: ['ops.operate'], active: true }, undefined, 'G6 revoke high risk authority', '123456', true);
    const start = requests.length;
    await expect(a.retry()).rejects.toThrow();
    await expect(o.retry()).rejects.toThrow();
    expect(a.view.pending || o.view.pending).toBe(false);
    expect(a.view.items).toEqual([]);
    expect(o.view.health).toBeUndefined();
    expect(requests.slice(start).every(r => r.method === 'GET')).toBe(true);
    const fresh = alerts(), c = await fresh.load();
    expect(c.capabilities).not.toContain('ops.operate');
    expect(c.capabilities).toContain('alerts.read');
    await fresh.open(id);
    expect(fresh.view.detail?.status).toBe('acked');
    expect(fresh.view.detail?.resolved).toBe(false);
    const n = requests.length;
    await expect(fresh.act('unack', 'G6 reader cannot regain write', '123456', true)).rejects.toMatchObject({ status: 403 });
    expect(requests.slice(n).every(r => r.method === 'GET')).toBe(true);
    await audit(g.view.receipts[0]);
    a.close();
    o.close();
    g.close();
    fresh.close();
}, 20000);
it('G6 governed flags refuse actual alert stream and incident timeline, recovery uses fresh authorized reads', async () => {
    const g = await readyAdmin(), o = ops();
    await o.load();
    await o.refresh();
    await o.inspectAlert(o.view.alerts[0].id);
    await o.act('open', 'G6 flag-bound incident', '123456', true);
    const id = o.view.selected!.id;
    for (const name of ['alerts-live-view', 'incident-timeline']) {
        await g.refresh();
        const r = g.view.rows.find(r => r.spec.kind === 'flag' && r.spec.name === name)!;
        await g.act('flags', 'PUT', { ...r.spec, enabled: false }, r.id, 'G6 governed view disable', '123456', true);
        await audit(g.view.receipts[0]);
        if (name === 'alerts-live-view') {
            const a = alerts();
            await a.load();
            await a.refresh();
            const before = a.view.items;
            await expect(a.connect()).rejects.toMatchObject({ status: 409, code: 'FEATURE_DISABLED' });
            expect(a.view.items).toEqual(before);
            expect(a.view.stream).toBe('reset-required');
            a.close();
        }
        else {
            await expect(o.open(id)).rejects.toMatchObject({ status: 409, code: 'FEATURE_DISABLED' });
            expect(o.view.selected).toBeUndefined();
        }
        await g.refresh();
        const next = g.view.rows.find(x => x.id === r.id)!;
        await g.act('flags', 'PUT', { ...next.spec, enabled: true }, next.id, 'G6 explicit governed view restore', '123456', true);
        await audit(g.view.receipts[0]);
    }
    const a = alerts(), fresh = ops();
    await a.load();
    await a.refresh();
    await a.connect(true);
    expect(a.view.stream).toBe('disconnected');
    await fresh.load();
    await fresh.open(id);
    expect(fresh.view.events?.items).toHaveLength(1);
    g.close();
    o.close();
    a.close();
    fresh.close();
}, 20000);
it('G6 last-admin, independent Approver and unresolved source preserve every explicit refusal', async () => {
    const g = await readyAdmin(), o = ops();
    const owner = g.view.rows.find(r => r.spec.kind === 'role' && r.spec.baseRole === 'owner')!, revision = g.view.revision;
    await expect(g.act('policies', 'POST', { kind: 'policy', name: 'g6_no_admin', roleId: owner.id, deniedCapabilities: ['admin.read'], active: true }, undefined, 'G6 last admin negative', '123456', true)).rejects.toMatchObject({ status: 409, code: 'LAST_ADMIN' });
    await g.refresh();
    expect(g.view.revision).toBe(revision);
    await g.act('capabilities', 'POST', { kind: 'capability', name: 'ops.approve', enabled: true }, undefined, 'G6 explicit independent fixture approval', '123456', true);
    await audit(g.view.receipts[0]);
    await o.load();
    await o.refresh();
    await o.inspectAlert(o.view.alerts[0].id);
    await o.act('open', 'G6 source still active', '123456', true);
    const id = o.view.selected!.id;
    await o.act('ack', 'G6 incident acknowledgement', '123456', true);
    const approver = ops('session-approver'), c = await approver.load();
    expect(c.capabilities).toContain('ops.approve');
    expect(c.capabilities).not.toContain('ops.operate');
    await approver.open(id);
    await expect(approver.act('resolve', 'G6 never invent repair', '123456', true)).rejects.toMatchObject({ status: 403 });
    const observed = await operationsClient(origin, transport('session-current')).GET('/v1/operations/incidents/{incidentId}', { params: { path: { incidentId: id } } });
    expect(observed.data?.status).toBe('acknowledged');
    await o.check('inspect-evidence', crypto.randomUUID());
    expect(o.view.check?.allowed).toBe(false);
    g.close();
    o.close();
    approver.close();
}, 20000);
