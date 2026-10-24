import { collectionOf, same, type Collection, type Resource, type Review, type Spec } from './policy';
export type ResourceState = 'all' | 'enabled' | 'disabled' | 'protected' | 'deleted';
export const typeLabels = { member: '成员', role: '角色', policy: '拒绝策略', capability: '权限能力', engine_capability: 'Engine 能力', flag: '功能开关' } as const;
export const resourceName = (r: Resource) => 'name' in r.spec ? r.spec.name : r.spec.actorId;
export function enabled(r: Resource) { if (r.deleted)
    return false; return 'active' in r.spec ? r.spec.active : 'enabled' in r.spec ? r.spec.enabled : true; }
export const stateLabel = (r: Resource) => r.deleted ? '已删除' : r.protected ? '受保护' : enabled(r) ? '启用' : '停用';
export function visibleResources(rows: Resource[], collection: Collection, search: string, state: ResourceState, kind = 'all') {
    const q = search.trim().toLocaleLowerCase();
    return rows.filter(r => collectionOf(r.spec) === collection && (kind === 'all' || r.spec.kind === kind) && (!q || [r.id, resourceName(r), JSON.stringify(r.spec)].some(v => v.toLocaleLowerCase().includes(q))) && (state === 'all' || state === 'deleted' && r.deleted || state === 'protected' && !r.deleted && r.protected || state === 'enabled' && enabled(r) || state === 'disabled' && !r.deleted && !enabled(r)));
}
export function currentReview(row: Resource | undefined, reviews: Review[]) { return row && !row.deleted && row.spec.kind === 'engine_capability' ? reviews.find(r => same({ ...r, enabled: row.spec.kind === 'engine_capability' && row.spec.enabled }, row.spec)) : undefined; }
export function summary(rows: Resource[], verified: boolean) {
    if (!verified)
        return undefined;
    const active = rows.filter(r => !r.deleted), members = active.filter(r => r.spec.kind === 'member'), ownerRoles = new Set(active.filter(r => r.spec.kind === 'role' && r.spec.baseRole === 'owner').map(r => r.id));
    return { members: members.filter(enabled).length, ownerActors: members.filter(r => r.spec.kind === 'member' && r.spec.active && ownerRoles.has(r.spec.roleId)).length, policies: active.filter(r => r.spec.kind === 'policy').length, activePolicies: active.filter(r => r.spec.kind === 'policy' && r.spec.active).length, engines: active.filter(r => r.spec.kind === 'engine_capability').length, enabledEngines: active.filter(r => r.spec.kind === 'engine_capability' && r.spec.enabled).length, flags: active.filter(r => r.spec.kind === 'flag').length, enabledFlags: active.filter(r => r.spec.kind === 'flag' && r.spec.enabled).length };
}
export function fieldFacts(s: Spec, rows: Resource[]): [
    string,
    string
][] {
    const role = (id: string) => { const r = rows.find(r => r.id === id && !r.deleted && r.spec.kind === 'role'); return r?.spec.kind === 'role' ? `${r.spec.name} · ${id}` : id + '（当前角色未核对）'; };
    switch (s.kind) {
        case 'member': return [['已登记身份', s.actorId], ['分配角色', role(s.roleId)], ['成员状态', s.active ? '有效' : '停用']];
        case 'role': return [['基础身份', s.baseRole], ['允许权限', s.permissions.join('、') || '无']];
        case 'policy': return [['应用角色', role(s.roleId)], ['拒绝权限', s.deniedCapabilities.join('、') || '无'], ['策略状态', s.active ? '有效' : '停用']];
        case 'capability': return [['权限名称', s.name], ['能力状态', s.enabled ? '启用' : '停用']];
        case 'engine_capability': return [['审查引用', s.reviewId], ['能力版本', s.version], ['审查描述', s.description || '—'], ['能力状态', s.enabled ? '启用' : '停用']];
        case 'flag': return [['开关名称', s.name], ['开关状态', s.enabled ? '启用' : '停用'], ['发布比例', s.rolloutPercent + '%']];
    }
}
const fieldLabels: Record<string, string> = { kind: '类型', actorId: '已登记身份', roleId: '分配角色', active: '有效状态', name: '名称', baseRole: '基础身份', permissions: '允许权限', deniedCapabilities: '拒绝权限', reviewId: '审查引用', version: '能力版本', description: '审查描述', enabled: '启用状态', rolloutPercent: '发布比例' };
export const displayField = (v: unknown) => v === undefined ? '—' : Array.isArray(v) ? v.join('、') || '无' : typeof v === 'boolean' ? v ? '是' : '否' : String(v);
export function fieldChanges(before: Spec | undefined, after: Spec) { const a = before ? Object.fromEntries(Object.entries(before)) : {}, b = Object.fromEntries(Object.entries(after)); return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => !same(a[k], b[k])).map(k => ({ key: k, label: fieldLabels[k] ?? k, before: displayField(a[k]), after: displayField(b[k]) })); }
export function sessionRecords(receipts: Resource[], id?: string) { return receipts.filter(r => !id || r.id === id).map(r => ({ id: r.id, kind: r.kind, objectVersion: r.objectVersion, configVersion: r.configVersion, deleted: r.deleted, auditRef: r.auditRef, correlationId: r.correlationId })); }
export function refusalText(code?: string) { return ({ LAST_ADMIN: '最后管理员保护：变更不能移除最后同时具备治理读写权限的管理员。', SELF_GOVERNANCE: '职责分离：不能修改自身或同一用户的治理身份。', SELF_APPROVAL: '职责分离：能力审查者不能自行启用其审查的能力。', ENGINE_REVIEW_EXPIRED: '签名审查已过期，请重新读取有效审查目录。', ENGINE_REVIEW_MISMATCH: '能力元数据与签名审查不一致。', RESOURCE_IN_USE: '资源仍被成员或策略引用，请先处理引用关系。', PROTECTED_RESOURCE: '此资源受服务端保护。', VERSION_CONFLICT: '版本冲突：当前配置或对象已变化。' } as Record<string, string>)[code ?? '']; }
