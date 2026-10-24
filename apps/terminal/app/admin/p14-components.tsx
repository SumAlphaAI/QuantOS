'use client';
import { useState } from 'react';
import type { RouteContext } from '../../src/auth/route-access';
import { labels, collections, collectionOf, type Collection, type Resource, type Review, type Spec } from '../../src/admin/policy';
import { typeLabels, resourceName, stateLabel, visibleResources, currentReview, summary, fieldFacts, fieldChanges, sessionRecords, type ResourceState } from '../../src/admin/p14-presentation';
export function GovernanceSummary({ rows, verified }: {
    rows: Resource[];
    verified: boolean;
}) {
    const s = summary(rows, verified);
    const cards = [['◎', '有效成员', s?.members, 'Owner 成员（actor）', s?.ownerActors], ['◇', '策略总数', s?.policies, '有效拒绝策略', s?.activePolicies], ['✓', 'Engine 能力', s?.engines, '配置为启用', s?.enabledEngines], ['⚑', '功能开关', s?.flags, '已启用', s?.enabledFlags]] as const;
    return <section className="p14-summary" aria-label="治理概览">{cards.map(([icon, title, value, detail, count]) => <article key={title}><span aria-hidden="true" className="p14-metric-icon">{icon}</span><div><p>{title}</p><strong>{value ?? '—'}</strong></div><div className="p14-metric-detail"><p>{detail}</p><b>{count ?? '—'}</b></div></article>)}</section>;
}
export function GovernanceTabs({ collection, rows, verified, locked }: {
    collection: Collection;
    rows: Resource[];
    verified: boolean;
    locked: boolean;
}) { return <nav className="p14-tabs" aria-label="治理分类">{collections.map(c => <a key={c} href={'/admin/' + c} aria-current={c === collection ? 'page' : undefined} onClick={e => { if (locked)
    e.preventDefault(); }}>{labels[c]}<span>{verified ? rows.filter(r => collectionOf(r.spec) === c && !r.deleted).length : '—'}</span></a>)}</nav>; }
export function ResourceCatalog({ collection, rows, revision, loading, locked, selected, onSelect, onNew, newDisabled }: {
    collection: Collection;
    rows: Resource[];
    revision?: string;
    loading: boolean;
    locked: boolean;
    selected?: Resource;
    onSelect: (r: Resource) => void;
    onNew: () => void;
    newDisabled: boolean;
}) {
    const [query, setQuery] = useState(''), [state, setState] = useState<ResourceState>('all'), [kind, setKind] = useState('all'), [page, setPage] = useState(1), filtered = visibleResources(rows, collection, query, state, kind), pages = Math.max(1, Math.ceil(filtered.length / 10)), current = Math.min(page, pages), visible = filtered.slice((current - 1) * 10, current * 10);
    return <section className="p14-panel p14-catalog" aria-label="治理资源"><header className="p14-panel-heading"><div><h2>{labels[collection]}治理目录</h2><p>已核对配置中的资源 · 删除保留墓碑与审计</p></div><button disabled={newDisabled} onClick={onNew}>新建{labels[collection]}</button></header>
 <div className="p14-filters"><label><span className="admin-sr-only">搜索治理资源</span><input type="search" placeholder="搜索名称、ID 或治理字段" value={query} disabled={locked} onChange={e => { setQuery(e.target.value); setPage(1); }}/></label><label><span className="admin-sr-only">治理状态筛选</span><select aria-label="治理状态筛选" value={state} disabled={locked} onChange={e => { setState(e.target.value as ResourceState); setPage(1); }}>{[['all', '全部状态'], ['enabled', '启用'], ['disabled', '停用'], ['protected', '受保护'], ['deleted', '已删除']].map(([v, t]) => <option value={v} key={v}>{t}</option>)}</select></label>{collection === 'capabilities' ? <label><span className="admin-sr-only">能力类型筛选</span><select aria-label="能力类型筛选" value={kind} disabled={locked} onChange={e => { setKind(e.target.value); setPage(1); }}><option value="all">全部类型</option><option value="capability">权限能力</option><option value="engine_capability">Engine 能力</option></select></label> : null}</div>
 {loading ? <p role="status" className="p14-empty">正在读取…</p> : !revision ? <p className="p14-empty">尚无已核对目录；请重新读取。</p> : filtered.length === 0 ? <p className="p14-empty">{query || state !== 'all' || kind !== 'all' ? '当前筛选无匹配资源。' : '当前目录为空。'}</p> : <div className="p14-table-scroll"><table><caption className="admin-sr-only">{labels[collection]}资源表格</caption><thead><tr><th scope="col">资源 / 类型</th><th scope="col">版本</th><th scope="col">状态</th><th scope="col">边界</th></tr></thead><tbody>{visible.map(r => <tr key={r.id} aria-selected={selected?.id === r.id}><td><button className="p14-resource-name" disabled={locked} onClick={() => onSelect(r)}>{resourceName(r)} <span className="admin-sr-only">{r.kind} · v{r.objectVersion} · {stateLabel(r)}</span></button><small title={r.id}>{typeLabels[r.spec.kind]} · {r.id}</small></td><td className="p14-mono">v{r.objectVersion}</td><td><span className={'p14-badge ' + (r.deleted ? 'p14-muted' : r.protected ? 'p14-cyan' : 'p14-neutral')}>{stateLabel(r)}</span></td><td><span className="p14-cell-boundary">{r.spec.kind === 'engine_capability' ? '签名审查' : r.spec.kind === 'role' ? r.spec.baseRole : r.spec.kind === 'flag' ? r.spec.rolloutPercent + '%' : '服务端校验'}</span></td></tr>)}</tbody></table></div>}
 <footer className="p14-table-footer"><span>当前一致配置共 {rows.filter(r => collectionOf(r.spec) === collection).length} 条，含墓碑；每类最多读取 1000 条。<br />{filtered.length} 条匹配 · 本页 {visible.length} 条</span><div><button aria-label="上一页治理资源" disabled={locked || current === 1} onClick={() => setPage(current - 1)}>‹</button><span>{current} / {pages}</span><button aria-label="下一页治理资源" disabled={locked || current === pages} onClick={() => setPage(current + 1)}>›</button></div></footer></section>;
}
export function ResourceFacts({ row, rows, reviews, context, verified, part = 'all' }: {
    part?: 'all' | 'identity' | 'boundary';
    row?: Resource;
    rows: Resource[];
    reviews: Review[];
    context: RouteContext;
    verified: boolean;
}) {
    const review = currentReview(row, reviews);
    return <>{part !== 'boundary' ? <section className="p14-facts" aria-label="资源身份详情"><h3><span>01</span>身份与治理来源</h3>{row ? <><div className="p14-selected-title"><strong>{resourceName(row)}</strong><span className="p14-badge p14-cyan">{typeLabels[row.spec.kind]}</span><span className="p14-badge">{verified ? '已读取' : '待重读'}</span></div><dl><div><dt>Resource ID</dt><dd>{row.id}</dd></div><div><dt>Object / Config</dt><dd>{row.objectVersion} / {row.configVersion}</dd></div><div><dt>当前状态</dt><dd>{stateLabel(row)}</dd></div><div><dt>会话范围</dt><dd>{context.mode.toUpperCase()} · {context.accountId}</dd></div></dl></> : <p>选择目录资源查看事实；新建变更将在审阅后提交。</p>}</section> : null}
 {part !== 'identity' ? <><div className="p14-detail-grid"><section className="p14-facts" aria-label="权限与能力边界"><h3><span>02</span>权限与能力边界</h3>{row ? <dl>{fieldFacts(row.spec, rows).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl> : <p>字段受当前原始身份与服务端治理规则约束。</p>}</section><section className="p14-facts" aria-label="审查与职责分离"><h3><span>03</span>审查与职责分离</h3><dl><div><dt>治理读权限</dt><dd>已核对</dd></div><div><dt>治理写权限</dt><dd>{context.capabilities.includes('admin.write') ? '会话已授予' : '未授予'}</dd></div><div><dt>最后管理员</dt><dd>服务端强制保护</dd></div><div><dt>职责分离</dt><dd>提交时服务端校验</dd></div><div><dt>MFA / 近期认证</dt><dd>每次提交重新验证</dd></div>{row?.spec.kind === 'engine_capability' ? <div><dt>当前审查目录</dt><dd>{review ? '元数据匹配' : '未提供有效匹配'}</dd></div> : null}</dl></section></div>
 {row?.spec.kind === 'engine_capability' ? <aside role="region" className="p14-source-gap" aria-label="签名证据边界">当前审查目录{review ? '匹配' : '未匹配'}；完整签名摘要、制品摘要、Provider、SBOM、License、CVE、风险等级及逐项审查报告未提供。管理权限不能绕过风险与执行边界。</aside> : null}</> : null}</>;
}
export function DraftDifference({ before, after }: {
    before?: Spec;
    after: Spec;
}) { const changes = fieldChanges(before, after); return <section className="p14-difference" aria-label="草稿字段差异"><h3>当前草稿字段差异</h3><p>比较已读取字段与当前草稿；完整历史版本未提供。</p>{changes.length ? <dl>{changes.map(r => <div key={r.key}><dt>{r.label}</dt><dd><del>{r.before}</del><ins>{r.after}</ins></dd></div>)}</dl> : <p>当前草稿与已读取字段相同。</p>}</section>; }
export function GovernanceRecords({ receipts, canAudit }: {
    receipts: Resource[];
    canAudit: boolean;
}) { const records = sessionRecords(receipts); return <section className="p14-panel p14-records" aria-label="治理审计回执"><header className="p14-panel-heading"><div><h2>本会话提交记录</h2><p>仅显示本次会话核对的最近 25 条提交；完整历史见 Audit。回执不赋予新的会话权限。</p></div><span className="p14-badge">非完整版本历史</span></header>{records.length === 0 ? <p className="p14-empty">尚无已核对提交。</p> : <ol className="p14-timeline">{records.map(r => <li key={r.auditRef}><span aria-hidden="true" className="p14-timeline-dot">✓</span><div><strong>{r.kind} · {r.deleted ? '已删除' : '已提交'} · v{r.objectVersion}</strong><p>id {r.id} · configVersion {r.configVersion}</p><p>auditRef {r.auditRef} · correlationId {r.correlationId}</p>{canAudit ? <a href={'/audit/' + r.correlationId}>查看关联审计</a> : null}</div></li>)}</ol>}</section>; }
