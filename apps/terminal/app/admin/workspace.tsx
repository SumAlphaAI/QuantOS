'use client';
import { useEffect, useRef, useState } from 'react';
import { ThemeProvider, TerminalFrame } from '@sumalpha/ui';
import { TerminalHeader, TerminalNavigation } from '@sumalpha/domain-ui/chrome';
import { visibleShellNavigation } from '@sumalpha/domain-ui/ui101';
import { createRouteAccess, browserAccessEnvironment, type RouteContext } from '../../src/auth/route-access';
import { desktopOperationsAllowed, useDesktopOperations } from '../../src/auth/desktop-operations';
import { settingsCsrf } from '../../src/settings/presentation';
import { createAdminRuntime, type AdminRuntime } from '../../src/admin/runtime';
import { adminLocation, labels, draft, type Collection, type Spec, type Resource } from '../../src/admin/policy';
import { AdminEditor } from './editor';
import { resourceName, refusalText } from '../../src/admin/p14-presentation';
import { GovernanceSummary, GovernanceTabs, ResourceCatalog, ResourceFacts, DraftDifference, GovernanceRecords } from './p14-components';
import {ActivationEntry} from '../../src/activation/page';
import './workspace.css';
function LegacyAdminEntry({ collection }: {
    collection: Collection;
}) {
    const [cycle, setCycle] = useState(0), [context, setContext] = useState<RouteContext>(), [lost, setLost] = useState(''), [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const controller = useRef<AdminRuntime>(undefined);
    useEffect(() => { const media = matchMedia('(prefers-color-scheme: light)'), sync = () => setTheme(media.matches ? 'light' : 'dark'); sync(); media.addEventListener('change', sync); return () => media.removeEventListener('change', sync); }, []);
    useEffect(() => {
        let alive = true;
        try {
            if (adminLocation(location.pathname, location.search) !== collection)
                throw Error('Route mismatch');
        }
        catch {
            setLost('Admin 路由无效。');
            return;
        }
        const monitor = createRouteAccess({ mock: false, origin: process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN, environment: browserAccessEnvironment(), onInvalidate(loss) {
                runtime.close();
                if (alive) {
                    setContext(undefined);
                    setLost(`访问条件变化，治理事实与恢复意图已清除：${loss.reason}`);
                }
            } });
        const runtime = createAdminRuntime({ origin: process.env.NEXT_PUBLIC_QUANTOS_BFF_ORIGIN ?? '', authorize: monitor.assertCurrent, online: () => navigator.onLine, csrf: () => settingsCsrf(document.cookie), desktop: desktopOperationsAllowed, invalidate: s => monitor.invalidate({ reason: 'revoked', status: s }) });
        controller.current = runtime;
        setLost('');
        setContext(undefined);
        void runtime.load().then(async (c) => {
            await monitor.bind(c);
            monitor.assertCurrent();
            if (alive)
                setContext(c);
        }).catch(() => {
            if (alive && !monitor.closed)
                monitor.invalidate({ reason: 'unavailable' });
        });
        return () => { alive = false; runtime.close(); monitor.close(); };
    }, [collection, cycle]);
    return <ThemeProvider theme={theme} onThemeChange={setTheme}>{context ? <Workspace context={context} collection={collection} runtime={controller.current!} toggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}/> : <main className="admin-access" data-route-access={lost ? 'denied' : 'loading'}><h1>{lost ? 'Admin 访问不可用' : '核对 Admin 访问权限'}</h1><p>{lost || '读取当前会话与治理权限。'}</p>{lost ? <button onClick={() => setCycle(n => n + 1)}>重新核对访问权限</button> : null}</main>}</ThemeProvider>;
}
function initial(c: Collection, rows: Resource[]): Spec { const role = rows.find(r => r.spec.kind === 'role' && r.spec.baseRole === 'viewer' && !r.deleted)?.id ?? ''; return c === 'members' ? { kind: 'member', actorId: '', roleId: role, active: true } : c === 'roles' ? { kind: 'role', name: '', baseRole: 'viewer', permissions: ['ops.read'] } : c === 'policies' ? { kind: 'policy', name: '', roleId: role, deniedCapabilities: [], active: true } : c === 'flags' ? { kind: 'flag', name: 'admin-catalog-preview', enabled: false, rolloutPercent: 0 } : { kind: 'capability', name: 'ops.approve', enabled: false }; }
function Workspace({ context, runtime, collection, toggle }: {
    context: RouteContext;
    runtime: AdminRuntime;
    collection: Collection;
    toggle: () => void;
}) {
    const [, update] = useState(0), [error, setError] = useState(''), [collapsed, setCollapsed] = useState(false), [selected, setSelected] = useState<Resource>(), [spec, setSpec] = useState<Spec>(() => initial(collection, [])), [editing, setEditing] = useState(false), [difference, setDifference] = useState(false), [copied, setCopied] = useState(''), [review, setReview] = useState<{
        method: 'POST' | 'PUT' | 'DELETE';
        spec: Spec;
        id?: string;
    }>(), [reason, setReason] = useState(''), [code, setCode] = useState(''), [accepted, setAccepted] = useState(false);
    const alive = useRef(true), dialog = useRef<HTMLDialogElement>(null), returnTo = useRef<HTMLElement | null>(null), desktop = useDesktopOperations(), v = runtime.view, locked = v.busy || v.pending || Date.now() < v.retryAt, write = context.capabilities.includes('admin.write') && desktop, unavailable = !write || locked || !v.revision;
    let valid = false;
    try {
        draft(spec, collection, v.rows, v.reviews);
        valid = true;
    }
    catch { /* Invalid forms cannot request proofs. */ }
    async function run(fn: () => Promise<void>) {
        setError('');
        try {
            await fn();
        }
        catch (e) {
            if (!alive.current)
                return;
            const x = e as {
                status?: number;
                code?: string;
                correlationId?: string;
            };
            setError(`${x.status === 429 ? '请求冷却中，请稍后显式重试。' : runtime.view.pending ? '操作结果未知，请恢复原请求。' : x.status === 409 ? '版本冲突或治理保护拒绝，请重新读取并审阅。' : '治理请求未获验证；请检查字段、权限与前置条件。'}${refusalText(x.code) ? ' ' + refusalText(x.code) : ''}${x.correlationId ? ' 关联 ID：' + x.correlationId : ''}`);
        }
    }
    function reset() { setCopied(''); setDifference(false); setSelected(undefined); setEditing(false); setSpec(initial(collection, runtime.view.rows)); }
    function close() { setReview(undefined); setReason(''); setCode(''); setAccepted(false); }
    function prepare(method: 'POST' | 'PUT' | 'DELETE') { returnTo.current = document.activeElement as HTMLElement; setReason(''); setCode(''); setAccepted(false); setReview({ method, spec: structuredClone(method === 'DELETE' ? selected!.spec : spec), id: editing ? selected?.id : undefined }); }
    useEffect(() => { alive.current = true; const off = runtime.subscribe(() => update(n => n + 1)), clock = setInterval(() => update(n => n + 1), 1000); void run(async () => { await runtime.refresh(); reset(); }); return () => { alive.current = false; off(); clearInterval(clock); }; }, [runtime]);
    useEffect(() => {
        if (!review)
            return;
        const el = dialog.current!;
        el.showModal();
        return () => { el.close(); returnTo.current?.focus(); };
    }, [review]);
    useEffect(() => {
        const leave = (e: BeforeUnloadEvent) => {
            if (v.pending) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', leave);
        return () => window.removeEventListener('beforeunload', leave);
    }, [v.pending]);
    async function copyId() { if (!selected)
        return; try {
        await navigator.clipboard.writeText(selected.id);
        setCopied('已复制资源 ID。');
    }
    catch {
        setCopied('复制未完成，请手动选择资源 ID。');
    } }
    return <TerminalFrame title="Admin" className="admin-frame" collapsed={collapsed} header={<TerminalHeader workspace={context.workspaceId.slice(0, 8)} workspaceTitle={context.workspaceId} account={context.accountId.slice(0, 8)} accountTitle={context.accountId} initials="Q" mode={context.mode} collapsed={collapsed} onToggle={() => setCollapsed(x => !x)} readOnlyControls notifications={null}/>} navigation={<TerminalNavigation activeRoute="/admin/members" items={visibleShellNavigation(context.capabilities).map(n => ({ ...n, badge: undefined }))}/>} status={<><span>{context.mode.toUpperCase()} · C01 授权</span><span>configVersion {v.revision ?? '未读取'}</span><span>Governance stream: 未提供</span><span>所有治理变更保留版本与审计</span></>}>
    <div className="admin-workspace p14" data-route-access="authorized">
    <header className="p14-page-header"><div><p className="p14-breadcrumb">Admin / {collection} / {selected ? selected.id.slice(0, 8) : 'new'}</p><h1>Administration</h1><p>当前工作区 · 成员、策略、能力与功能治理</p></div><div className="p14-toolbar"><button disabled title="当前服务未提供成员导出能力">导出成员清单</button>{context.capabilities.includes('audit:read') ? <a href="/audit">查看治理审计</a> : <button disabled title="当前会话未授予 audit:read">查看治理审计</button>}<button disabled={locked} onClick={() => void run(async () => { reset(); await runtime.refresh(); reset(); })}>重新读取治理目录</button><button onClick={toggle}>切换主题</button><span className="p14-badge p14-cyan">Admin · {write ? '可提交' : '只读'}</span></div></header>
    <aside className="p14-context-band">ⓘ 当前工作区 {context.workspaceId} · 账户 {context.accountId} · {context.mode.toUpperCase()}。治理不能提升原始身份权限。</aside>
    <GovernanceTabs collection={collection} rows={v.rows} verified={!!v.revision} locked={v.pending || v.busy}/>
    <GovernanceSummary rows={v.rows} verified={!!v.revision}/>
    <p className="p14-safety-note">所有治理操作须提供原因、MFA、近期认证与版本；删除保留墓碑及审计事实。{!desktop ? '移动端只读，写操作须在桌面端进行。' : !write ? '当前会话只读。' : '服务端 Owner 权限与职责分离规则决定最终接受。'}</p>
    {error ? <p role="alert" className="p14-error">{error}</p> : null}
    {v.pending ? <section aria-label="操作结果未知" className="p14-unknown"><div><h2>操作结果未知</h2><p>原请求已冻结；禁止新意图。仅当前会话可显式恢复，离开、撤权或失效将清除恢复意图。</p></div><button disabled={v.busy || !write || Date.now() < v.retryAt} onClick={() => void run(async () => { await runtime.retry(); reset(); })}>恢复原请求</button></section> : null}
    <div className="p14-workbench"><div className="p14-list-column">
    <ResourceCatalog collection={collection} rows={v.rows} revision={v.revision} loading={v.status === 'loading'} locked={locked} selected={selected} newDisabled={unavailable} onNew={reset} onSelect={r => { setSelected(r); setEditing(true); setSpec(structuredClone(r.spec)); setError(''); setCopied(''); setDifference(false); }}/>
    <GovernanceRecords receipts={v.receipts} canAudit={context.capabilities.includes('audit:read')}/>
    </div><section className="p14-panel p14-detail" aria-label="治理编辑"><header className="p14-panel-heading"><div><p>{labels[collection]}详情</p><h2>{editing ? '查看 / 修改' : '新建'}{labels[collection]}</h2></div><div className="p14-detail-actions"><button disabled={!selected || locked} onClick={() => void copyId()}>复制 ID</button><button disabled={locked} onClick={reset}>关闭治理详情</button></div></header>
    {copied ? <p role="status" className="p14-copy-feedback">{copied}</p> : null}
    <ResourceFacts part="identity" row={selected} rows={v.rows} reviews={v.reviews} context={context} verified={!!v.revision}/><div className="p14-governance-grid"><div className="p14-checks-column"><ResourceFacts part="boundary" row={selected} rows={v.rows} reviews={v.reviews} context={context} verified={!!v.revision}/></div>
    <section className="p14-change" aria-label="提交受控变更"><div className="p14-change-title"><h3><span>04</span>提交受控变更</h3><button disabled={locked} aria-expanded={difference} onClick={() => setDifference(x => !x)}>查看字段差异</button></div>
    {selected ? <p className="p14-version-note">id {selected.id} · objectVersion {selected.objectVersion} · {selected.protected ? '受保护，不能修改' : selected.deleted ? '墓碑只读' : v.revision ? '版本控制' : '待重新读取当前配置'}</p> : null}
    {difference ? <DraftDifference before={selected?.spec} after={spec}/> : null}
    {collection === 'capabilities' && !editing ? <label>能力类别<select aria-label="能力类别" disabled={unavailable} value={spec.kind} onChange={e => setSpec(e.target.value === 'capability' ? initial('capabilities', v.rows) : { kind: 'engine_capability', reviewId: '', name: '', version: '', description: '', enabled: false })}><option value="capability">权限能力</option><option value="engine_capability">Engine 签名能力</option></select></label> : null}
    <AdminEditor value={spec} onChange={setSpec} rows={v.rows} reviews={v.reviews} disabled={unavailable || !!selected && (selected.deleted || selected.protected)} editing={editing}/>
    <div className="admin-actions"><button className="p14-primary" disabled={unavailable || !valid || !!selected && (selected.deleted || selected.protected)} onClick={() => prepare(editing ? 'PUT' : 'POST')}>审阅{editing ? '修改' : '创建'}</button>{selected ? <button className="p14-danger" disabled={unavailable || selected.deleted || selected.protected} onClick={() => prepare('DELETE')}>审阅删除</button> : null}</div>
    </section></div><footer className="p14-detail-footer"><span>Object version {selected?.objectVersion ?? '新建'}</span><span>MFA · 提交时验证</span><span>职责分离 · 服务端强制</span></footer></section></div>
    <footer className="p14-page-footer"><span>⚠ 管理权限不能绕过风险、审批或执行边界。</span><span>服务未提供完整审批历史、逐项签名证据、持续治理流及成员导出。</span></footer>
 {review ? <dialog ref={dialog} className="admin-dialog" aria-label="确认治理操作" onCancel={e => {
                e.preventDefault();
                if (!v.busy)
                    close();
            }}><h2>确认治理操作 · {review.method}</h2><p>{selected ? resourceName(selected) : labels[collection] + '新资源'} · {context.mode.toUpperCase()}</p><p>{review.id ?? '新资源'} · If-Match {editing ? selected?.objectVersion : v.revision}</p><pre>{JSON.stringify(review.spec, null, 2)}</pre><p>服务端校验最后管理员保护、职责分离、签名审查与审计。删除保留历史事实。</p><form onSubmit={e => {
                e.preventDefault();
                void run(async () => {
                    try {
                        await runtime.act(collection, review.method, review.spec, review.id, reason, code, accepted);
                        reset();
                    }
                    finally {
                        close();
                    }
                });
            }}><label>操作原因<input disabled={locked} maxLength={256} value={reason} onChange={e => setReason(e.target.value)}/></label><label>MFA 验证码<input disabled={locked} type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value)}/></label><label className="admin-check"><input type="checkbox" disabled={locked} checked={accepted} onChange={e => setAccepted(e.target.checked)}/>确认治理字段、影响与版本</label><button disabled={locked || !write || !accepted || !reason.trim() || !/^\d{6}$/.test(code)}>提交治理操作</button><button type="button" disabled={v.busy} onClick={close}>取消</button></form></dialog> : null}
 </div></TerminalFrame>;
}

export function AdminEntry({collection}:{collection:Collection}){return collection==='flags'?<ActivationEntry legacy={<LegacyAdminEntry collection={collection}/>}/>:<LegacyAdminEntry collection={collection}/>;}
