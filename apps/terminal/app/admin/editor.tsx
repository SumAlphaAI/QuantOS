'use client';
import { permissions, rolePermissions, flagNames, type Spec, type Resource, type Review } from '../../src/admin/policy';
export function AdminEditor({ value: s, onChange, rows, reviews, disabled, editing }: {
    value: Spec;
    onChange: (s: Spec) => void;
    rows: Resource[];
    reviews: Review[];
    disabled: boolean;
    editing: boolean;
}) {
    const roles = rows.filter(r => r.spec.kind === 'role' && !r.deleted), boolean = (label: string, value: boolean, set: (v: boolean) => void) => <label className="admin-check"><input type="checkbox" checked={value} disabled={disabled} onChange={e => set(e.target.checked)}/>{label}</label>;
    const roleSelect = (id: string, set: (v: string) => void) => <label>角色<select aria-label="角色" value={id} disabled={disabled} onChange={e => set(e.target.value)}><option value="">选择现有角色</option>{roles.map(r => <option key={r.id} value={r.id}>{r.spec.kind === 'role' ? r.spec.name : r.id}</option>)}</select></label>;
    return <fieldset disabled={disabled}><legend>治理字段 · {s.kind}</legend>
 {s.kind === 'member' ? <><label>已登记 actorId<input value={s.actorId} disabled={editing} onChange={e => onChange({ ...s, actorId: e.target.value })}/></label>{roleSelect(s.roleId, roleId => onChange({ ...s, roleId }))}{boolean('成员有效', s.active, active => onChange({ ...s, active }))}<p>只管理已登记身份；不能邀请用户或提升原始身份权限。当前用户变更由服务端职责分离规则拒绝。</p></> : null}
 {s.kind === 'role' ? <><label>角色名称<input maxLength={64} value={s.name} onChange={e => onChange({ ...s, name: e.target.value })}/></label><label>基础身份<select value={s.baseRole} onChange={e => onChange({ ...s, baseRole: e.target.value as typeof s.baseRole, permissions: [] })}>{s.baseRole === 'owner' || s.baseRole === 'service' ? <option value={s.baseRole}>{s.baseRole}（受保护）</option> : null}{(['operator', 'approver', 'viewer'] as const).map(r => <option key={r}>{r}</option>)}</select></label><fieldset><legend>允许权限（受基础身份上限约束）</legend>{permissions.map(p => <label className="admin-check" key={p}><input type="checkbox" checked={s.permissions.includes(p)} disabled={disabled || !(rolePermissions[s.baseRole] as readonly string[]).includes(p)} onChange={e => onChange({ ...s, permissions: e.target.checked ? [...s.permissions, p] : s.permissions.filter(x => x !== p) })}/>{p}</label>)}</fieldset></> : null}
 {s.kind === 'policy' ? <><label>策略名称<input maxLength={64} value={s.name} onChange={e => onChange({ ...s, name: e.target.value })}/></label>{roleSelect(s.roleId, roleId => onChange({ ...s, roleId }))}<fieldset><legend>拒绝权限</legend>{permissions.map(p => <label className="admin-check" key={p}><input type="checkbox" checked={s.deniedCapabilities.includes(p)} onChange={e => onChange({ ...s, deniedCapabilities: e.target.checked ? [...s.deniedCapabilities, p] : s.deniedCapabilities.filter(x => x !== p) })}/>{p}</label>)}</fieldset>{boolean('策略有效', s.active, active => onChange({ ...s, active }))}<p>拒绝策略不能移除最后一名同时具备读写权限的管理员。</p></> : null}
 {s.kind === 'capability' ? <><label>权限名称<select value={s.name} onChange={e => onChange({ ...s, name: e.target.value as typeof s.name })}>{permissions.map(p => <option key={p}>{p}</option>)}</select></label>{boolean('能力启用', s.enabled, enabled => onChange({ ...s, enabled }))}</> : null}
 {s.kind === 'engine_capability' ? <><label>签名审查目录<select value={s.reviewId + '|' + s.name + '|' + s.version} onChange={e => {
                const r = reviews.find(r => r.reviewId + '|' + r.name + '|' + r.version === e.target.value);
                if (r)
                    onChange({ ...r, enabled: s.enabled });
            }}><option value="">选择服务端有效审查</option>{reviews.map(r => <option key={r.reviewId + '|' + r.name + '|' + r.version} value={r.reviewId + '|' + r.name + '|' + r.version}>{r.name} · {r.version} · {r.reviewId}</option>)}</select></label><details className="p14-review-metadata"><summary>查看草稿审查元数据</summary><dl><dt>reviewId</dt><dd>{s.reviewId || '未提供'}</dd><dt>能力 / 版本</dt><dd>{s.name || '未提供'} / {s.version || '未提供'}</dd><dt>描述</dt><dd>{s.description || '—'}</dd></dl></details>{boolean('Engine 能力启用', s.enabled, enabled => onChange({ ...s, enabled }))}<p>只接受服务端签名审查的原始元数据。服务端再次校验审查有效期与审查者/启用者分离；空目录不能自行签名。</p></> : null}
 {s.kind === 'flag' ? <><label>开关名称<select value={s.name} onChange={e => onChange({ ...s, name: e.target.value as typeof s.name })}>{flagNames.map(n => <option key={n}>{n}</option>)}</select></label>{boolean('开关启用', s.enabled, enabled => onChange({ ...s, enabled }))}<label>发布比例（0–100）<input type="number" min={0} max={100} step={1} value={s.rolloutPercent} onChange={e => onChange({ ...s, rolloutPercent: e.target.value === '' ? NaN : Number(e.target.value) })}/></label></> : null}
 </fieldset>;
}
