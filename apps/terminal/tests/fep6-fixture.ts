// Explicit in-process consumer model. No BFF, F06 authentication, signature verification,
// core repair, database or durable recovery is established by this transport.
import { createAlertsRuntime } from '../src/alerts/runtime';
import { createOperationsRuntime } from '../src/operations/runtime';
import { createAdminRuntime } from '../src/admin/runtime';
import { opsContext, opsNow, opsId, opsOther, opsHealth, opsAlert, opsIncident, opsCatalog, opsRun } from './fixtures/scenarios/operations';
import type { Resource, Spec } from '../src/admin/policy';
export function fep6Model() {
    let now = opsNow, allowed = true, online = true, desktop = true, lose = false, commits = 0, revision = 0;
    const operator = { ...opsContext, capabilities: ['alerts.read', 'ops.read', 'ops.operate', 'audit:read'] }, owner = { ...opsContext, actorId: opsOther, capabilities: ['alerts.read', 'ops.read', 'ops.operate', 'admin.read', 'admin.write'] }, requests: Request[] = [], invalidations: number[] = [], intents = new Map<string, {
        body: string;
        match: string | null;
        status: number;
        value: unknown;
    }>();
    let alert = opsAlert(), incident: ReturnType<typeof opsIncident> | undefined;
    const events: {
        eventId: string;
        occurredAt: string;
        payload: ReturnType<typeof opsIncident>;
        correlationId: string;
    }[] = [], review = { kind: 'engine_capability' as const, reviewId: opsOther, name: 'owned.model.research', version: '1.0', description: 'Explicit model metadata, not a verified signature', enabled: false };
    const roleId = '33333333-3333-4333-8333-333333333333', flagId = '44444444-4444-4444-8444-444444444444';
    const rows: Resource[] = [{ id: roleId, kind: 'roles', objectVersion: '0', configVersion: '0', deleted: false, protected: true, spec: { kind: 'role', name: 'viewer', baseRole: 'viewer', permissions: ['ops.read'] } }, { id: flagId, kind: 'feature-flags', objectVersion: '0', configVersion: '0', deleted: false, protected: false, spec: { kind: 'flag', name: 'ops-notices', enabled: false, rolloutPercent: 0 } }];
    const config = (actor: 'operator' | 'owner') => ({ origin: 'https://fixture.invalid', now: () => now, online: () => online, desktop: () => desktop, authorize: () => { if (!allowed)
            throw Error('Model authority lost'); }, csrf: () => 'fixture-csrf', invalidate: (s: number) => { invalidations.push(s); allowed = false; }, fetchImpl: (async (i, n) => {
            const req = new Request(i, n), u = new URL(req.url), path = u.pathname;
            if (u.origin !== 'https://fixture.invalid')
                throw Error('Model must never use network');
            requests.push(req.clone());
            if (path === '/v1/session' || path === '/v1/context')
                return Response.json(actor === 'owner' ? owner : operator);
            if (path.endsWith('/challenges'))
                return Response.json({ challengeRef: opsId, status: 'verified' });
            if (path.endsWith('/reauth'))
                return Response.json({ reauthTokenRef: opsOther, expiresAt: new Date(now + 60000).toISOString() });
            const write = req.method !== 'GET';
            if (!write) {
                if (path === '/v1/alerts')
                    return Response.json({ items: [alert], configVersion: String(revision), nextCursor: null });
                if (path === '/v1/alerts/' + opsId)
                    return Response.json(alert);
                if (path === '/v1/alerts/subscriptions')
                    return Response.json({ domains: ['system'], severities: ['warning'], objectVersion: '0' });
                if (path === '/v1/operations/health' || path === '/v1/operations/metrics')
                    return Response.json(opsHealth());
                if (path === '/v1/operations/runbook-actions')
                    return Response.json({ items: opsCatalog });
                if (path.endsWith('/prechecks')) {
                    const action = path.split('/').at(-2)!;
                    return Response.json({ actionId: action, allowed: action === 'inspect-health', reason: action === 'inspect-health' ? 'allowed' : 'source_evidence_unavailable', sourceVersion: '1', expiresAt: opsHealth().expiresAt });
                }
                if (path === '/v1/operations/incidents')
                    return Response.json({ items: incident ? [incident] : [], configVersion: String(revision), nextCursor: null });
                if (path.endsWith('/timeline'))
                    return Response.json({ items: events });
                if (path.startsWith('/v1/operations/incidents/'))
                    return Response.json(incident);
                if (path.startsWith('/v1/admin/')) {
                    const kind = path.split('/').at(-1);
                    return Response.json({ items: rows.filter(r => r.kind === kind).map(r => ({ ...r, configVersion: String(revision) })), configVersion: String(revision), nextCursor: null, ...kind === 'capabilities' ? { availableReviews: [review] } : {} });
                }
                throw Error('Unexpected model GET ' + path);
            }
            const key = req.headers.get('idempotency-key'), body = await req.text(), match = req.headers.get('if-match');
            if (!key || !match || !req.headers.get('x-csrf-token'))
                throw Error('Model write header absent');
            const old = intents.get(key);
            if (old) {
                if (old.body !== body || old.match !== match)
                    throw Error('Model intent changed');
                return Response.json(old.value, { status: old.status });
            }
            const input = JSON.parse(body);
            let value: unknown, status = 200;
            revision++;
            commits++;
            if (path === '/v1/alerts/' + opsId + '/ack') {
                alert = { ...alert, status: 'acked', objectVersion: String(Number(alert.objectVersion) + 1), ackActor: operator.actorId, ackAt: new Date(now).toISOString(), auditRef: opsOther };
                value = alert;
            }
            else if (path === '/v1/operations/incidents') {
                incident = opsIncident();
                events.push({ eventId: crypto.randomUUID(), occurredAt: new Date(now).toISOString(), payload: structuredClone(incident), correlationId: opsOther });
                value = { ...incident, auditRef: opsId, correlationId: opsOther };
                status = 201;
            }
            else if (path.endsWith('/ack') && incident) {
                incident = { ...incident, status: 'acknowledged', objectVersion: String(Number(incident.objectVersion) + 1) };
                events.push({ eventId: crypto.randomUUID(), occurredAt: new Date(now).toISOString(), payload: structuredClone(incident), correlationId: opsOther });
                value = { ...incident, auditRef: opsId, correlationId: opsOther };
            }
            else if (path === '/v1/operations/runbook-actions/inspect-health/runs')
                value = opsRun();
            else if (path.startsWith('/v1/admin/')) {
                const kind = path.split('/')[3] as Resource['kind'], id = path.split('/')[4], before = rows.find(r => r.id === id), spec: Spec = req.method === 'DELETE' ? before!.spec : input.spec;
                const row = { id: before?.id ?? crypto.randomUUID(), kind, objectVersion: before ? String(Number(before.objectVersion) + 1) : '0', configVersion: String(revision), deleted: req.method === 'DELETE', protected: false, spec, auditRef: opsId, correlationId: opsOther } as Resource;
                if (before)
                    rows.splice(rows.indexOf(before), 1, row);
                else
                    rows.push(row);
                value = row;
                if (req.method === 'POST')
                    status = 201;
            }
            else
                throw Error('Unexpected model mutation ' + path);
            intents.set(key, { body, match, status, value: structuredClone(value) });
            if (lose) {
                lose = false;
                throw Error('Explicit model committed-response loss');
            }
            return Response.json(value, { status });
        }) as typeof fetch });
    const alerts = createAlertsRuntime(config('operator')), operations = createOperationsRuntime(config('operator')), admin = createAdminRuntime(config('owner'));
    return { alerts, operations, admin, operator, owner, review, requests, invalidations, roleId, flagId, get commits() { return commits; }, get source() { return structuredClone(alert); }, loseNext() { lose = true; }, advance(ms: number) { now += ms; }, offline() { online = false; }, revoke() { allowed = false; }, mobile() { desktop = false; }, withdrawOperate() { operator.capabilities = operator.capabilities.filter(c => c !== 'ops.operate'); }, close() { alerts.close(); operations.close(); admin.close(); } };
}
