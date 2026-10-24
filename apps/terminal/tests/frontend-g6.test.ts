import { it, expect } from 'vitest';
import { createAlertsRuntime } from '../src/alerts/runtime';
import { createOperationsRuntime } from '../src/operations/runtime';
import { opsContext as context, opsNow as now, opsId as id, opsOther as other, opsHealth, opsAlert, opsCatalog, opsRun } from './fixtures/scenarios/operations';
function setup(kind: 'alerts' | 'operations', status: number, where: 'write' | 'identity') {
    let refused = false, dispatched = false;
    const invalid: number[] = [], writes: Request[] = [];
    const t: typeof fetch = async (i, n) => {
        const r = new Request(i, n), p = new URL(r.url).pathname;
        if (refused && (where === 'identity' ? p === '/v1/session' : r.method === 'POST' && !p.startsWith('/v1/auth/')))
            return new Response('<html>authority refused</html>', { status });
        if (p === '/v1/session' || p === '/v1/context')
            return Response.json(context);
        if (p.endsWith('/challenges'))
            return Response.json({ challengeRef: id, status: 'verified' });
        if (p.endsWith('/reauth'))
            return Response.json({ reauthTokenRef: other, expiresAt: new Date(now + 60000).toISOString() });
        if (p === '/v1/operations/health' || p === '/v1/operations/metrics')
            return Response.json(opsHealth());
        if (p === '/v1/operations/runbook-actions')
            return Response.json({ items: opsCatalog });
        if (p.endsWith('/prechecks'))
            return Response.json({ actionId: 'inspect-health', allowed: true, reason: 'allowed', sourceVersion: '1', expiresAt: opsHealth().expiresAt });
        if (p === '/v1/operations/incidents')
            return Response.json({ items: [], configVersion: '0', nextCursor: null });
        if (p === '/v1/alerts')
            return Response.json({ items: [opsAlert()], configVersion: '0', nextCursor: null });
        if (r.method === 'POST') {
            writes.push(r.clone());
            if (!dispatched) {
                dispatched = true;
                throw Error('explicit consumer transport fault');
            }
            return Response.json(kind === 'operations' ? opsRun() : { ...opsAlert(), objectVersion: '2', status: 'acked', ackActor: context.actorId, ackAt: new Date(now).toISOString(), auditRef: id });
        }
        return Response.json(opsAlert());
    };
    const config = { origin: 'https://owned.test', fetchImpl: t, authorize: () => { }, online: () => true, csrf: () => 'owned-csrf', desktop: () => true, now: () => now, invalidate: (s: number) => invalid.push(s) };
    return { runtime: kind === 'alerts' ? createAlertsRuntime(config) : createOperationsRuntime(config), invalid, writes, refuse: () => { refused = true; } };
}
for (const kind of ['alerts', 'operations'] as const)
    for (const status of [401, 403])
        for (const where of ['write', 'identity'] as const)
            it(`G6 ${kind} non-JSON ${status} at ${where} clears private facts and original intent`, async () => {
                const s = setup(kind, status, where), r = s.runtime;
                await r.load();
                await r.refresh();
                if (kind === 'alerts') {
                    const a = r as ReturnType<typeof createAlertsRuntime>;
                    await a.open(id);
                    await expect(a.act('ack', 'explicit consumer review', '123456', true)).rejects.toThrow();
                }
                else {
                    const o = r as ReturnType<typeof createOperationsRuntime>;
                    await o.check('inspect-health');
                    await expect(o.act('run', 'explicit consumer review', '123456', true)).rejects.toThrow();
                }
                expect(r.view.pending).toBe(true);
                s.refuse();
                await expect(r.retry()).rejects.toThrow();
                expect(s.invalid).toContain(status);
                expect(r.view.pending).toBe(false);
                if (kind === 'alerts') {
                    const v = (r as ReturnType<typeof createAlertsRuntime>).view;
                    expect(v.items).toEqual([]);
                    expect(v.detail).toBeUndefined();
                    expect(v.evidence).toBeUndefined();
                }
                else {
                    const v = (r as ReturnType<typeof createOperationsRuntime>).view;
                    expect(v.health).toBeUndefined();
                    expect(v.check).toBeUndefined();
                    expect(v.run).toBeUndefined();
                }
                r.close();
            });
it.each(['alerts', 'operations'] as const)('G6 %s non-JSON 500 remains unknown and explicit retry preserves frozen intent', async (kind) => { const s = setup(kind, 500, 'write'), r = s.runtime; await r.load(); await r.refresh(); if (kind === 'alerts') {
    const a = r as ReturnType<typeof createAlertsRuntime>;
    await a.open(id);
    await expect(a.act('ack', 'explicit consumer review', '123456', true)).rejects.toThrow();
}
else {
    const o = r as ReturnType<typeof createOperationsRuntime>;
    await o.check('inspect-health');
    await expect(o.act('run', 'explicit consumer review', '123456', true)).rejects.toThrow();
} s.refuse(); await expect(r.retry()).rejects.toThrow(); expect(r.view.pending).toBe(true); expect(s.invalid).toEqual([]); r.close(); });
