import { referenceBffExecutable, referenceBffRoot, referenceBffSourceEnv } from "./helpers/reference-bff";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { beforeAll, afterAll, expect, it } from "vitest";
import { createAdminRuntime } from "../src/admin/runtime";
import type { Collection, Spec, Resource } from "../src/admin/policy";
import { loadEvidenceChain } from "../src/audit/gateway";
let child: ChildProcess, origin: string, lose = '';
const requests: Request[] = [];
const csrf = 'csrf-token-0000000000000001';
const transport = (session = 'session-owner'): typeof fetch => async (input, init) => { const req = new Request(input, init); req.headers.set('cookie', `quantos_session=${session}; quantos_csrf=${csrf}`); req.headers.set('origin', 'http://localhost:3190'); requests.push(req.clone()); const res = await fetch(req); if (lose && ['POST', 'PUT', 'DELETE'].includes(req.method) && req.url.includes(lose)) {
    lose = '';
    await res.body?.cancel();
    throw Error('lost reply after committed governance');
} return res; };
beforeAll(async () => { const server = createServer(); await new Promise<void>(r => server.listen(0, '127.0.0.1', r)); const port = (server.address() as {
    port: number;
}).port; await new Promise<void>(r => server.close(() => r())); origin = `http://127.0.0.1:${port}`; child = spawn(referenceBffExecutable(), [], { cwd: referenceBffRoot, env: { ...referenceBffSourceEnv(), NODE_ENV: 'test', PATH: process.env.PATH, HOME: process.env.HOME, QUANTOS_SKIP_ENV: '1', QUANTOS_BFF_MODE: 'reference', QUANTOS_BFF_BIND: `127.0.0.1:${port}` }, stdio: ['ignore', 'pipe', 'pipe'] }); await new Promise<void>((r, j) => { const t = setTimeout(() => j(Error('startup timeout')), 30000); child.once('error', e => { clearTimeout(t); j(e); }); child.once('exit', () => { clearTimeout(t); j(Error('reference exited')); }); child.stdout?.on('data', b => { if (String(b).includes('"ready":true')) {
    clearTimeout(t);
    r();
} }); }); }, 35000);
afterAll(async () => { if (child?.exitCode === null) {
    child.kill();
    await new Promise(r => child.once('close', r));
} });
const make = (options: {
    session?: string;
    desktop?: boolean;
    now?: () => number;
    fetchImpl?: typeof fetch;
} = {}) => createAdminRuntime({ origin, fetchImpl: options.fetchImpl ?? transport(options.session), authorize: () => { }, online: () => true, csrf: () => csrf, desktop: () => options.desktop ?? true, invalidate: () => { }, now: options.now });
async function ready() { const r = make(); await r.load(); await r.refresh(); return r; }
async function audit(row: Resource) { const chain = await loadEvidenceChain(origin, row.correlationId!, {}, transport('session-current')); expect(chain.items.some(e => e.eventId === row.auditRef)).toBe(true); }
it('UI602 real C01/C11/C10 all five resource families CRUD, frozen recovery, tombstones and audit', async () => {
    const r = await ready();
    expect(r.view.rows.length).toBeGreaterThan(5);
    const role = r.view.rows.find(r => r.spec.kind === 'role' && r.spec.baseRole === 'viewer')!;
    const specs: [
        Collection,
        Spec
    ][] = [['roles', { kind: 'role', name: 'ui602_reader', baseRole: 'viewer', permissions: ['ops.read'] }], ['policies', { kind: 'policy', name: 'ui602_deny', roleId: role.id, deniedCapabilities: ['alerts.read'], active: true }], ['capabilities', { kind: 'capability', name: 'ops.approve', enabled: false }], ['flags', { kind: 'flag', name: 'ops-notices', enabled: false, rolloutPercent: 0 }]];
    for (const [c, s] of specs) {
        const start = requests.length;
        lose = '/v1/admin/' + (c === 'flags' ? 'feature-flags' : c);
        await expect(r.act(c, 'POST', s, undefined, 'UI602 controlled create', '123456', true)).rejects.toThrow();
        expect(r.view.pending).toBe(true);
        await expect(r.refresh()).rejects.toMatchObject({ code: 'RECOVERY_REQUIRED' });
        await r.retry();
        const row = r.view.receipts[0];
        await audit(row);
        const writes = requests.slice(start).filter(q => q.method === 'POST' && q.url.includes('/v1/admin/'));
        expect(writes).toHaveLength(2);
        expect(await writes[0].text()).toBe(await writes[1].text());
        for (const h of ['idempotency-key', 'if-match', 'x-request-id', 'x-csrf-token'])
            expect(writes[0].headers.get(h)).toBe(writes[1].headers.get(h));
        await r.refresh();
        const changed = { ...s, ...s.kind === 'role' ? { name: 'ui602_reader_changed' } : s.kind === 'policy' ? { active: false } : { enabled: true } } as Spec;
        await r.act(c, 'PUT', changed, row.id, 'UI602 controlled update', '123456', true);
        await audit(r.view.receipts[0]);
        await r.refresh();
        await r.act(c, 'DELETE', changed, row.id, 'UI602 controlled delete', '123456', true);
        await audit(r.view.receipts[0]);
        await r.refresh();
        expect(r.view.rows.find(x => x.id === row.id)?.deleted).toBe(true);
    }
    const operator = r.view.rows.find(x => x.spec.kind === 'role' && x.spec.baseRole === 'operator')!;
    await r.act('members', 'POST', { kind: 'member', actorId: '66666666-6666-4666-8666-666666666666', roleId: operator.id, active: true }, undefined, 'UI602 add registered standby', '123456', true);
    const member = r.view.receipts[0];
    await audit(member);
    await r.refresh();
    await r.act('members', 'PUT', { ...member.spec, active: false }, member.id, 'UI602 deactivate standby identity', '123456', true);
    await audit(r.view.receipts[0]);
    await r.refresh();
    await r.act('members', 'DELETE', member.spec, member.id, 'UI602 standby tombstone', '123456', true);
    await audit(r.view.receipts[0]);
    await r.refresh();
    const flag = r.view.rows.find(x => x.spec.kind === 'flag' && !x.deleted)!;
    await r.act('flags', 'PUT', { ...flag.spec, enabled: true, rolloutPercent: 25 }, flag.id, 'UI602 bounded rollout', '123456', true);
    await audit(r.view.receipts[0]);
    await r.refresh();
    const reviewed = r.view.reviews[0];
    expect(reviewed).toBeDefined();
    await r.act('capabilities', 'POST', { ...reviewed, enabled: true }, undefined, 'UI602 signed engine enable', '123456', true);
    const engine = r.view.receipts[0];
    await audit(engine);
    await r.refresh();
    await r.act('capabilities', 'PUT', { ...engine.spec, enabled: false } as Spec, engine.id, 'UI602 signed engine disable', '123456', true);
    await audit(r.view.receipts[0]);
    await r.refresh();
    await r.act('capabilities', 'DELETE', engine.spec, engine.id, 'UI602 engine tombstone', '123456', true);
    await audit(r.view.receipts[0]);
    expect(r.view.receipts.length).toBe(19);
    r.close();
}, 30000);
it('UI602 last-admin and self-governance refusals preserve actual admission and config', async () => {
    for (const kind of ['capability', 'policy', 'member'] as const) {
        const r = await ready(), rev = r.view.revision;
        const ownerRole = r.view.rows.find(x => x.spec.kind === 'role' && x.spec.baseRole === 'owner')!, c = kind === 'capability' ? 'capabilities' : kind === 'policy' ? 'policies' : 'members', target = r.view.rows.find(x => kind === 'capability' ? x.spec.kind === 'capability' && x.spec.name === 'admin.read' : x.spec.kind === 'member' && x.spec.roleId === ownerRole.id)!;
        const spec: Spec = kind === 'policy' ? { kind: 'policy', name: 'ui602_no_admin', roleId: ownerRole.id, deniedCapabilities: ['admin.read'], active: true } : kind === 'capability' ? { kind: 'capability', name: 'admin.read', enabled: false } : { ...target.spec, active: false } as Spec;
        await expect(r.act(c, kind === 'policy' ? 'POST' : 'PUT', spec, kind === 'policy' ? undefined : target.id, 'UI602 last admin negative probe', '123456', true)).rejects.toMatchObject({ status: 409, code: 'LAST_ADMIN' });
        expect(r.view.pending).toBe(false);
        await r.refresh();
        expect(r.view.revision).toBe(rev);
        r.close();
    }
}, 20000);
it('UI602 desktop/read authority, invalid review, confirmation and protected resources cannot dispatch business writes', async () => {
    const denied = make({ session: 'session-current' });
    await expect(denied.load()).rejects.toMatchObject({ status: 403 });
    expect(denied.view.rows).toEqual([]);
    denied.close();
    const r = await ready(), n = requests.length, protectedRole = r.view.rows.find(x => x.spec.kind === 'role' && x.protected)!;
    await expect(r.act('roles', 'DELETE', protectedRole.spec, protectedRole.id, 'no', '123456', true)).rejects.toMatchObject({ code: 'RESOURCE_UNAVAILABLE' });
    await expect(r.act('roles', 'POST', { kind: 'role', name: 'unchecked', baseRole: 'viewer', permissions: ['ops.read'] }, undefined, 'no', '123456', false)).rejects.toThrow();
    await expect(r.act('capabilities', 'POST', { kind: 'engine_capability', reviewId: crypto.randomUUID(), name: 'forged', version: '1', description: '', enabled: true }, undefined, 'no', '123456', true)).rejects.toThrow();
    expect(requests.slice(n).some(x => x.method !== 'GET')).toBe(false);
    r.close();
    const mobile = make({ desktop: false });
    await mobile.load();
    await mobile.refresh();
    await expect(mobile.act('roles', 'POST', {}, undefined, 'no', '123456', true)).rejects.toMatchObject({ status: 403 });
    mobile.close();
}, 15000);
it('UI602 a changed config after review refuses before the write; mixed pages never publish', async () => {
    const r = await ready(), other = await ready(), spec: Spec = { kind: 'role', name: 'ui602_concurrent', baseRole: 'viewer', permissions: ['ops.read'] };
    await other.act('roles', 'POST', spec, undefined, 'UI602 concurrent change', '123456', true);
    const n = requests.length;
    await expect(r.act('roles', 'POST', { ...spec, name: 'ui602_stale' }, undefined, 'UI602 stale review', '123456', true)).rejects.toMatchObject({ status: 409, code: 'VERSION_CONFLICT' });
    expect(requests.slice(n).some(x => x.url.includes('/v1/admin/') && x.method !== 'GET')).toBe(false);
    expect(r.view.rows).toEqual([]);
    r.close();
    other.close();
    const t = transport(), mixed = make({ fetchImpl: async (input, init) => { const q = new Request(input, init), res = await t(q); if (q.url.includes('/v1/admin/roles?')) {
            const raw = await res.json();
            raw.configVersion = '999';
            return Response.json(raw);
        } return res; } });
    await mixed.load();
    await expect(mixed.refresh()).rejects.toMatchObject({ code: 'CATALOG_CHANGED' });
    expect(mixed.view.rows).toEqual([]);
    mixed.close();
}, 15000);
it('UI602 committed malformed receipt remains uncertain, refuses new intent and clears private recovery on revocation', async () => {
    const t = transport();
    let tamper = true, revoked = false;
    const r = make({ fetchImpl: async (input, init) => { const q = new Request(input, init); if (revoked && q.url.endsWith('/v1/session'))
            return Response.json({ code: 'FORBIDDEN', message: 'private', correlationId: crypto.randomUUID() }, { status: 403 }); const res = await t(q); if (tamper && q.method === 'POST' && q.url.includes('/v1/admin/')) {
            tamper = false;
            const raw = await res.json();
            delete raw.auditRef;
            return Response.json(raw, { status: res.status });
        } return res; } });
    await r.load();
    await r.refresh();
    const s: Spec = { kind: 'role', name: 'ui602_receipt', baseRole: 'viewer', permissions: ['ops.read'] };
    await expect(r.act('roles', 'POST', s, undefined, 'UI602 malformed response', '123456', true)).rejects.toThrow();
    expect(r.view.pending).toBe(true);
    await r.retry();
    expect(r.view.pending).toBe(false);
    await r.refresh();
    lose = '/v1/admin/roles';
    await expect(r.act('roles', 'POST', { ...s, name: 'ui602_revoke' }, undefined, 'UI602 revoke unknown', '123456', true)).rejects.toThrow();
    revoked = true;
    await expect(r.retry()).rejects.toMatchObject({ status: 403 });
    expect(r.view.pending).toBe(false);
    expect(r.view.rows).toEqual([]);
    expect(r.view.receipts).toEqual([]);
    r.close();
}, 15000);
it('UI602 expiry and changed CSRF erase private intent without replay', async () => {
    let clock = Date.now(), token = csrf;
    const t = transport(), r = createAdminRuntime({ origin, fetchImpl: t, authorize: () => { }, online: () => true, csrf: () => token, desktop: () => true, invalidate: () => { }, now: () => clock });
    const c = await r.load();
    await r.refresh();
    clock = Date.parse(c.expiresAt);
    let n = requests.length;
    await expect(r.refresh()).rejects.toMatchObject({ status: 401 });
    expect(requests).toHaveLength(n);
    expect(r.view.rows).toEqual([]);
    r.close();
    const recovery = createAdminRuntime({ origin, fetchImpl: t, authorize: () => { }, online: () => true, csrf: () => token, desktop: () => true, invalidate: () => { } });
    await recovery.load();
    await recovery.refresh();
    lose = '/v1/admin/roles';
    await expect(recovery.act('roles', 'POST', { kind: 'role', name: 'ui602_csrf', baseRole: 'viewer', permissions: ['ops.read'] }, undefined, 'UI602 csrf negative', '123456', true)).rejects.toThrow();
    expect(recovery.view.pending).toBe(true);
    token = 'changed-csrf';
    n = requests.length;
    await expect(recovery.retry()).rejects.toMatchObject({ status: 403, code: 'CSRF_CHANGED' });
    expect(requests.slice(n).every(q => q.method === 'GET')).toBe(true);
    expect(recovery.view.pending).toBe(false);
    expect(recovery.view.receipts).toEqual([]);
    recovery.close();
}, 15000);
