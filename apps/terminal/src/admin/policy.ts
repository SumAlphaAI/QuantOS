import { bffZodSchemas, type BffComponents } from '@sumalpha/api-client';
export type Resource = BffComponents['schemas']['AdminResource'];
export type Spec = BffComponents['schemas']['AdminSpec'];
export type Review = BffComponents['schemas']['AdminEngineCapabilitySpec'];
export const collections = ['members', 'roles', 'policies', 'capabilities', 'flags'] as const;
export type Collection = typeof collections[number];
export const labels: Record<Collection, string> = { members: '成员', roles: '角色', policies: '策略', capabilities: '能力', flags: '功能开关' };
export const permissions = ['ops.read', 'ops.operate', 'ops.approve', 'admin.read', 'admin.write', 'alerts.read'] as const;
export const flagNames = ['alerts-live-view', 'incident-timeline', 'admin-catalog-preview', 'ops-notices'] as const;
export const rolePermissions = { owner: ['ops.read', 'ops.operate', 'admin.read', 'admin.write', 'alerts.read'], operator: ['ops.read', 'ops.operate', 'alerts.read'], approver: ['ops.read', 'ops.approve', 'alerts.read'], viewer: ['ops.read', 'alerts.read'], service: ['ops.read'] } as const;
export const apiPath = (c: Collection) => '/v1/admin/' + (c === 'flags' ? 'feature-flags' : c);
export function adminLocation(path: string, search: string): Collection { if (search)
    throw Error('Unexpected query'); const c = collections.find(c => path === '/admin/' + c); if (!c)
    throw Error('Invalid admin route'); return c; }
export const collectionOf = (s: Spec): Collection => s.kind === 'member' ? 'members' : s.kind === 'role' ? 'roles' : s.kind === 'policy' ? 'policies' : s.kind === 'flag' ? 'flags' : 'capabilities';
export function version(s: string) { if (!/^(0|[1-9][0-9]*)$/.test(s) || BigInt(s) > 18446744073709551614n)
    throw Error('Invalid version'); return BigInt(s); }
function canonical(v: unknown): unknown { if (Array.isArray(v))
    return v.map(canonical); if (v && typeof v === 'object')
    return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canonical(x)])); return v; }
export const same = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export function resource(raw: unknown, c: Collection) { const r = bffZodSchemas.AdminResource.parse(raw); if (collectionOf(r.spec) !== c || r.kind !== (c === 'flags' ? 'feature-flags' : c))
    throw Error('Resource kind mismatch'); version(r.objectVersion); version(r.configVersion); return r; }
export const core = (r: Resource) => ({ id: r.id, kind: r.kind, spec: r.spec, objectVersion: r.objectVersion, deleted: r.deleted, protected: r.protected });
export function draft(raw: unknown, c: Collection, rows: Resource[], reviews: Review[]): Spec {
    const s = bffZodSchemas.AdminSpec.parse(raw);
    if (collectionOf(s) !== c)
        throw Error('Wrong collection');
    if (s.kind === 'role') {
        if (s.baseRole === 'owner' || s.baseRole === 'service' || new Set(s.permissions).size !== s.permissions.length || s.permissions.some(p => !(rolePermissions[s.baseRole] as readonly string[]).includes(p)))
            throw Error('Role exceeds original authority');
    }
    if (s.kind === 'policy' || s.kind === 'member') {
        if (!rows.some(r => r.id === s.roleId && r.spec.kind === 'role' && !r.deleted))
            throw Error('Role unavailable');
    }
    if (s.kind === 'policy' && new Set(s.deniedCapabilities).size !== s.deniedCapabilities.length)
        throw Error('Duplicate denial');
    if (s.kind === 'engine_capability' && !reviews.some(r => same({ ...r, enabled: s.enabled }, s)))
        throw Error('Signed review unavailable');
    return s;
}
export function committed(raw: unknown, c: Collection, method: 'POST' | 'PUT' | 'DELETE', spec: Spec, before: Resource | undefined, revision: string) { const r = resource(raw, c); if (!r.auditRef || !r.correlationId || !same(r.spec, spec) || r.deleted !== (method === 'DELETE') || r.protected || version(r.objectVersion) !== (before ? version(before.objectVersion) + 1n : 0n) || version(r.configVersion) !== version(revision) + 1n || before && r.id !== before.id || spec.kind === 'member' && r.id !== spec.actorId)
    throw Error('Unverified governance receipt'); return r; }
